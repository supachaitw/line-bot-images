// =============================================================================
//  TANACHOK (ระบบงานสลากธนโชค) — Pipeline SIT
//  build image จาก Tag version บน branch main แล้ว deploy ลง SIT
//
//  อ้างอิงมาตรฐาน CI/CD ของธนาคาร (แบบเดียวกับ Linkage Center 2):
//    - ติด Tag version ได้ที่ branch main เท่านั้น รูปแบบ vx.x.xx
//    - deploy ได้เฉพาะ commit ที่มี Tag version
//    - หลัง deploy หน้าจอต้องแสดง Tag version ให้ตรวจสอบได้
//
//  *** ข้อจำกัดสำคัญ: Jenkins ของธนาคารไม่ต่ออินเทอร์เน็ต ***
//    - base image ทุกตัวต้อง pull จาก Nexus เท่านั้น
//    - dependency (npm / maven) ต้องอยู่ใน base image ที่นำส่งธนาคารไว้แล้ว
//      หรือดึงผ่าน proxy repository ภายในของ Nexus
//
//  ค่าที่เป็น <PLACEHOLDER> ตั้งเป็น Jenkins Global env / Credentials
//  ห้าม hardcode host, IP, user, password ลงในไฟล์นี้
// =============================================================================

pipeline {
  agent { label 'docker-linux' }          // agent ที่ build docker image ได้

  options {
    timestamps()
    disableConcurrentBuilds()
    buildDiscarder(logRotator(numToKeepStr: '30'))
    timeout(time: 45, unit: 'MINUTES')
  }

  parameters {
    string(name: 'TAG_VERSION', defaultValue: '',
           description: 'Tag version ที่จะ build/deploy เช่น v1.0.01 (ต้องเป็น tag บน branch main)')
    booleanParam(name: 'RUN_DB_MIGRATION', defaultValue: true,
           description: 'รัน database migration ก่อน deploy')
  }

  environment {
    APP           = 'tanachok'
    ENV_NAME      = 'sit'
    REGISTRY      = "${env.NEXUS_REGISTRY}"          // ตั้งที่ Jenkins Global env
    REGISTRY_CRED = 'nexus-docker-credentials'       // Jenkins Credentials ID
    DB_CRED       = 'tanachok-sit-db'                // Jenkins Credentials (username/password)
    // รูปแบบ tag ของธนาคาร: vx.x.xx — บางโครงการใช้ 4 ส่วน (v1.118.0.0)
    // ให้ยืนยันรูปแบบที่ใช้จริงกับทีม QA ก่อนใช้งาน
    TAG_PATTERN   = '^v[0-9]+\\.[0-9]+\\.[0-9]+(\\.[0-9]+)?$'
  }

  stages {

    stage('ตรวจสอบ Tag version') {
      steps {
        script {
          if (!params.TAG_VERSION?.trim()) {
            error 'ต้องระบุ TAG_VERSION — Pipeline SIT deploy ได้เฉพาะ commit ที่มี Tag version'
          }
          if (!(params.TAG_VERSION ==~ env.TAG_PATTERN)) {
            error "รูปแบบ Tag ไม่ถูกต้อง: ${params.TAG_VERSION} (ต้องเป็น vx.x.xx)"
          }
        }
      }
    }

    stage('Checkout tag') {
      steps {
        checkout([$class: 'GitSCM',
          branches: [[name: "refs/tags/${params.TAG_VERSION}"]],
          extensions: [[$class: 'CloneOption', noTags: false, shallow: false]],
          userRemoteConfigs: [[url: env.GIT_REPO_URL, credentialsId: 'gitlab-ad-credentials']]
        ])
        script {
          // ยืนยันว่า tag นี้อยู่บน main จริง — ธนาคารกำหนดให้ติด tag ได้ที่ main เท่านั้น
          def onMain = sh(returnStatus: true,
            script: "git merge-base --is-ancestor ${params.TAG_VERSION} origin/main")
          if (onMain != 0) {
            error "Tag ${params.TAG_VERSION} ไม่ได้อยู่บน branch main — ผิดกติกาของธนาคาร"
          }
          env.GIT_SHA = sh(returnStdout: true, script: 'git rev-parse --short HEAD').trim()
          echo "จะ build จาก ${params.TAG_VERSION} (${env.GIT_SHA})"
        }
      }
    }

    stage('Lint & Unit test') {
      steps {
        sh './ci/run-tests.sh'                       // ทีมพัฒนาเขียนสคริปต์นี้
      }
      post {
        always { junit allowEmptyResults: true, testResults: 'reports/junit/*.xml' }
      }
    }

    stage('Build images') {
      steps {
        script {
          // ฝัง version ลง image ตามที่ธนาคารกำหนดให้ตรวจสอบได้จากหน้าจอ
          def buildArgs = "--build-arg APP_VERSION=${params.TAG_VERSION} " +
                          "--build-arg GIT_SHA=${env.GIT_SHA}"
          // tanachok-web: multi-stage — vite build แล้วเสิร์ฟผ่าน nginx
          // (ไม่ใช้ Vite dev server บน env ที่สูงกว่า dev)
          ['api', 'web', 'pdf'].each { svc ->
            sh """
              docker build ${buildArgs} \
                -f docker/Dockerfile.${svc} \
                -t ${env.REGISTRY}/${env.APP}-${svc}:${params.TAG_VERSION} .
            """
          }
        }
      }
    }

    stage('Push to Nexus') {
      steps {
        withCredentials([usernamePassword(credentialsId: env.REGISTRY_CRED,
                                          usernameVariable: 'REG_USER',
                                          passwordVariable: 'REG_PASS')]) {
          sh '''
            echo "$REG_PASS" | docker login "$REGISTRY" -u "$REG_USER" --password-stdin
          '''
          script {
            ['api', 'web', 'pdf'].each { svc ->
              sh "docker push ${env.REGISTRY}/${env.APP}-${svc}:${params.TAG_VERSION}"
            }
          }
          // บันทึก digest ไว้ให้ Pipeline UAT ตรวจว่าใช้ image เดียวกับ SIT จริง
          withEnv(["TAG=${params.TAG_VERSION}"]) {
            sh '''
              : > image-digests.txt
              for svc in api web pdf; do
                docker inspect --format '{{index .RepoDigests 0}}' \
                  "$REGISTRY/$APP-$svc:$TAG" >> image-digests.txt
              done
              cat image-digests.txt
            '''
          }
        }
      }
      post {
        always {
          archiveArtifacts artifacts: 'image-digests.txt', allowEmptyArchive: true
          sh 'docker logout "$REGISTRY" || true'
        }
      }
    }

    stage('สำรองฐานข้อมูลก่อน migrate') {
      when { expression { params.RUN_DB_MIGRATION } }
      steps {
        withCredentials([usernamePassword(credentialsId: env.DB_CRED,
                                          usernameVariable: 'PGUSER',
                                          passwordVariable: 'PGPASSWORD')]) {
          sh './ci/db-backup.sh "$ENV_NAME"'         // pg_dump + ตรวจ checksum
        }
      }
    }

    stage('Database migration') {
      when { expression { params.RUN_DB_MIGRATION } }
      steps {
        withCredentials([usernamePassword(credentialsId: env.DB_CRED,
                                          usernameVariable: 'PGUSER',
                                          passwordVariable: 'PGPASSWORD')]) {
          // migration แยกขั้นจาก deploy และต้องรันซ้ำได้ไม่พัง (idempotent)
          sh './ci/db-migrate.sh "$ENV_NAME"'
        }
      }
    }

    stage('Deploy') {
      steps {
        // ใช้ deploy script แบบเดียวกับโครงการอื่นของธนาคาร
        // restart semantics เท่านั้น — ห้ามใช้ --force-recreate (ข้อมูลใน volume จะหาย)
        sh "IMAGE_TAG=${params.TAG_VERSION} ./deploy-${env.ENV_NAME}.sh deploy-only ${params.TAG_VERSION}"
      }
    }

    stage('Health check') {
      steps {
        sh "./deploy-${env.ENV_NAME}.sh health"
      }
    }

    stage('ตรวจว่า version ที่ขึ้นตรงกับ tag') {
      steps {
        script {
          // ธนาคารกำหนด: หลัง deploy ต้องตรวจสอบ version ที่ deploy ได้จากหน้าจอ/endpoint
          def deployed = sh(returnStdout: true,
            script: "curl -sf http://localhost:8800/version | sed -n 's/.*\"version\":\"\\([^\"]*\\)\".*/\\1/p'").trim()
          if (deployed != params.TAG_VERSION) {
            error "version ที่ขึ้นจริง (${deployed}) ไม่ตรงกับ tag ที่สั่ง deploy (${params.TAG_VERSION})"
          }
          echo "ยืนยันแล้ว: SIT กำลังรัน ${deployed}"
        }
      }
    }

    stage('Smoke test') {
      steps {
        sh './ci/smoke-test.sh "$ENV_NAME"'
      }
    }
  }

  post {
    success {
      echo "SIT deploy ${params.TAG_VERSION} สำเร็จ — ส่งต่อให้ Pipeline UAT ใช้ image ชุดเดียวกันนี้"
    }
    failure {
      echo "SIT deploy ${params.TAG_VERSION} ไม่สำเร็จ — ดู log แล้วแก้ที่ branch dev ก่อนติด tag ใหม่"
    }
  }
}
