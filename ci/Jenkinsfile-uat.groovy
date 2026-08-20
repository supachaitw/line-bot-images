// =============================================================================
//  TANACHOK (ระบบงานสลากธนโชค) — Pipeline UAT
//
//  กติกาของธนาคาร: UAT ต้องใช้ image เดียวกับ SIT เสมอ
//  -> pipeline นี้ "ไม่มี stage build" โดยเจตนา ห้ามเพิ่ม
//     ถ้า build ใหม่ = ไม่ใช่ image เดียวกับที่ทดสอบผ่าน SIT แล้ว
// =============================================================================

pipeline {
  agent { label 'docker-linux' }

  options {
    timestamps()
    disableConcurrentBuilds()
    buildDiscarder(logRotator(numToKeepStr: '30'))
    timeout(time: 60, unit: 'MINUTES')
  }

  parameters {
    string(name: 'TAG_VERSION', defaultValue: '',
           description: 'Tag version ที่ผ่าน SIT แล้ว เช่น v1.0.01')
    string(name: 'SIT_BUILD_NUMBER', defaultValue: '',
           description: 'เลข build ของ Pipeline SIT ที่ deploy tag นี้ (ใช้ตรวจ digest)')
    booleanParam(name: 'SEND_TO_SECURITY_SCAN', defaultValue: true,
           description: 'ส่งให้ Security Team scan source code (Pipeline SEC) หลัง UAT ผ่าน')
  }

  environment {
    APP           = 'tanachok'
    ENV_NAME      = 'uat'
    REGISTRY      = "${env.NEXUS_REGISTRY}"
    REGISTRY_CRED = 'nexus-docker-credentials'
    DB_CRED       = 'tanachok-uat-db'
    SEC_JOB       = 'tanachok-sec'
  }

  stages {

    stage('ตรวจ image ว่ามีอยู่จริงใน Nexus') {
      steps {
        withCredentials([usernamePassword(credentialsId: env.REGISTRY_CRED,
                                          usernameVariable: 'REG_USER',
                                          passwordVariable: 'REG_PASS')]) {
          withEnv(["TAG=${params.TAG_VERSION}"]) {
            sh '''
              echo "$REG_PASS" | docker login "$REGISTRY" -u "$REG_USER" --password-stdin
              for svc in api web pdf; do
                docker manifest inspect "$REGISTRY/$APP-$svc:$TAG" > /dev/null \
                  || { echo "ไม่พบ image $APP-$svc:$TAG ใน Nexus — ต้องผ่าน Pipeline SIT ก่อน"; exit 1; }
              done
            '''
          }
        }
      }
    }

    stage('ยืนยันว่าเป็น image เดียวกับ SIT') {
      when { expression { params.SIT_BUILD_NUMBER?.trim() } }
      steps {
        // ดึง digest ที่ Pipeline SIT บันทึกไว้ แล้วเทียบกับที่อยู่ใน Nexus ตอนนี้
        copyArtifacts projectName: 'tanachok-sit',
                      selector: specific(params.SIT_BUILD_NUMBER),
                      filter: 'image-digests.txt'
        withEnv(["TAG=${params.TAG_VERSION}"]) {
          sh '''
            : > current-digests.txt
            for svc in api web pdf; do
              docker manifest inspect "$REGISTRY/$APP-$svc:$TAG" -v \
                | sed -n 's/.*"digest": "\\(sha256:[a-f0-9]*\\)".*/\\1/p' | head -1 >> current-digests.txt
            done
            if ! grep -qFf current-digests.txt image-digests.txt; then
              echo "digest ไม่ตรงกับที่ Pipeline SIT บันทึกไว้ — image ถูก build ใหม่ ผิดกติกาของธนาคาร"
              diff image-digests.txt current-digests.txt || true
              exit 1
            fi
            echo "ยืนยันแล้ว: UAT ใช้ image ชุดเดียวกับ SIT"
          '''
        }
      }
    }

    stage('ขออนุมัติ deploy UAT') {
      steps {
        timeout(time: 8, unit: 'HOURS') {
          input message: "อนุมัติ deploy ${params.TAG_VERSION} ลง UAT?", ok: 'อนุมัติ'
        }
      }
    }

    stage('สำรองฐานข้อมูล') {
      steps {
        withCredentials([usernamePassword(credentialsId: env.DB_CRED,
                                          usernameVariable: 'PGUSER',
                                          passwordVariable: 'PGPASSWORD')]) {
          sh './ci/db-backup.sh "$ENV_NAME"'
        }
      }
    }

    stage('Database migration') {
      steps {
        withCredentials([usernamePassword(credentialsId: env.DB_CRED,
                                          usernameVariable: 'PGUSER',
                                          passwordVariable: 'PGPASSWORD')]) {
          sh './ci/db-migrate.sh "$ENV_NAME"'
        }
      }
    }

    stage('Deploy') {
      steps {
        sh "IMAGE_TAG=${params.TAG_VERSION} ./deploy-${env.ENV_NAME}.sh deploy-only ${params.TAG_VERSION}"
      }
    }

    stage('Health check + ตรวจ version') {
      steps {
        sh "./deploy-${env.ENV_NAME}.sh health"
        script {
          def deployed = sh(returnStdout: true,
            script: "curl -sf http://localhost:8800/version | sed -n 's/.*\"version\":\"\\([^\"]*\\)\".*/\\1/p'").trim()
          if (deployed != params.TAG_VERSION) {
            error "version ที่ขึ้นจริง (${deployed}) ไม่ตรงกับ tag (${params.TAG_VERSION})"
          }
        }
      }
    }

    stage('Smoke test') {
      steps { sh './ci/smoke-test.sh "$ENV_NAME"' }
    }

    stage('ส่ง Security Team scan') {
      when { expression { params.SEND_TO_SECURITY_SCAN } }
      steps {
        build job: env.SEC_JOB, wait: false,
              parameters: [string(name: 'TAG_VERSION', value: params.TAG_VERSION)]
        echo "ส่ง ${params.TAG_VERSION} เข้า Pipeline SEC แล้ว — รอ Security Team อนุมัติก่อนขึ้น PROD"
      }
    }
  }

  post {
    always { sh 'docker logout "$REGISTRY" || true' }
  }
}
