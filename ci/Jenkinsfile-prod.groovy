// =============================================================================
//  TANACHOK (ระบบงานสลากธนโชค) — Pipeline PROD
//
//  กติกาของธนาคาร:
//    - ไม่มี stage build — ใช้ image เดิมที่ผ่าน SIT/UAT มาแล้ว
//    - deploy ได้เฉพาะ version ที่ผ่านการอนุมัติจาก Pipeline SEC เท่านั้น
//    - ต้องมีเลข PAR (Change Control) ที่อนุมัติแล้ว
//
//  เพิ่มเฉพาะธนโชค (โครงการอื่นของธนาคารไม่มี):
//    *** ตรวจยอดคงเหลือของลูกค้าก่อน/หลัง deploy ต้องตรงกันทุกบาท ***
//    ระบบนี้ถือเงินลูกค้า ความถูกต้องของยอดสำคัญกว่าการ deploy สำเร็จ
// =============================================================================

pipeline {
  agent { label 'docker-linux' }

  options {
    timestamps()
    disableConcurrentBuilds()
    buildDiscarder(logRotator(numToKeepStr: '90'))
    timeout(time: 4, unit: 'HOURS')
  }

  parameters {
    string(name: 'TAG_VERSION', defaultValue: '',
           description: 'Tag version ที่ผ่าน Pipeline SEC แล้ว (ห้ามใช้ latest)')
    string(name: 'PAR_NUMBER', defaultValue: '',
           description: 'เลข PAR (Change Control) ที่อนุมัติแล้ว')
    booleanParam(name: 'RUN_DB_MIGRATION', defaultValue: false,
           description: 'รอบนี้มีการเปลี่ยน schema หรือ Stored Procedure หรือไม่')
  }

  environment {
    APP           = 'tanachok'
    ENV_NAME      = 'prod'
    REGISTRY      = "${env.NEXUS_REGISTRY}"
    REGISTRY_CRED = 'nexus-docker-credentials'
    DB_CRED       = 'tanachok-prod-db'
  }

  stages {

    stage('ตรวจเงื่อนไขก่อนเริ่ม') {
      steps {
        script {
          if (!params.TAG_VERSION?.trim() || params.TAG_VERSION == 'latest') {
            error 'PROD ต้องระบุ Tag version ที่ชัดเจน — ห้ามใช้ latest'
          }
          if (!params.PAR_NUMBER?.trim()) {
            error 'ต้องระบุเลข PAR ที่อนุมัติแล้วก่อน deploy production'
          }
        }
      }
    }

    stage('ตรวจว่าผ่าน Pipeline SEC แล้ว') {
      steps {
        withCredentials([usernamePassword(credentialsId: env.REGISTRY_CRED,
                                          usernameVariable: 'REG_USER',
                                          passwordVariable: 'REG_PASS')]) {
          withEnv(["TAG=${params.TAG_VERSION}"]) {
            // Pipeline SEC ติด label ไว้บน image เมื่ออนุมัติผลการ scan
            // ถ้าธนาคารใช้วิธีอื่น (เช่น promote ไป repo แยก) ให้เปลี่ยน stage นี้ให้ตรง
            sh '''
              echo "$REG_PASS" | docker login "$REGISTRY" -u "$REG_USER" --password-stdin
              docker pull "$REGISTRY/$APP-api:$TAG"
              APPROVED=$(docker image inspect "$REGISTRY/$APP-api:$TAG" \
                          --format '{{ index .Config.Labels "gsb.sec.approved" }}')
              if [ "$APPROVED" != "true" ]; then
                echo "Tag $TAG ยังไม่ผ่านการอนุมัติจาก Pipeline SEC — deploy ไม่ได้"
                exit 1
              fi
            '''
          }
        }
      }
    }

    stage('บันทึกยอดคงเหลือก่อน deploy') {
      steps {
        withCredentials([usernamePassword(credentialsId: env.DB_CRED,
                                          usernameVariable: 'PGUSER',
                                          passwordVariable: 'PGPASSWORD')]) {
          // สรุปยอดคงเหลือรวมของผู้ถือสลาก + จำนวนรายการ เก็บไว้เทียบหลัง deploy
          sh './ci/reconcile-balance.sh "$ENV_NAME" > balance-before.txt'
          sh 'cat balance-before.txt'
        }
      }
    }

    stage('ขออนุมัติจากผู้มีอำนาจ') {
      steps {
        timeout(time: 2, unit: 'HOURS') {
          input message: """deploy ${params.TAG_VERSION} ขึ้น Production (PAR ${params.PAR_NUMBER})?
                            ยืนยันว่าแจ้ง stakeholder และอยู่ใน change window แล้ว""",
                ok: 'ยืนยัน deploy',
                submitter: 'gsb-operations'
        }
      }
    }

    stage('สำรองฐานข้อมูลเต็มชุด') {
      steps {
        withCredentials([usernamePassword(credentialsId: env.DB_CRED,
                                          usernameVariable: 'PGUSER',
                                          passwordVariable: 'PGPASSWORD')]) {
          // ต้องผ่าน — ห้าม deploy ถ้ายังไม่มีจุดย้อนกลับ
          sh './ci/db-backup.sh "$ENV_NAME" --verify'
        }
      }
    }

    stage('บันทึก image ปัจจุบันไว้สำหรับ rollback') {
      steps {
        sh '''
          mkdir -p .deploy-state
          docker inspect tanachok-api --format '{{.Config.Image}}' > .deploy-state/prod.last-image || true
          cat .deploy-state/prod.last-image || echo "(ยังไม่มี container เดิม)"
        '''
        archiveArtifacts artifacts: '.deploy-state/prod.last-image', allowEmptyArchive: true
      }
    }

    stage('Database migration') {
      when { expression { params.RUN_DB_MIGRATION } }
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
        // restart semantics เท่านั้น — ห้าม --force-recreate (ข้อมูลใน volume จะหาย)
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

    stage('กระทบยอดคงเหลือหลัง deploy') {
      steps {
        withCredentials([usernamePassword(credentialsId: env.DB_CRED,
                                          usernameVariable: 'PGUSER',
                                          passwordVariable: 'PGPASSWORD')]) {
          sh './ci/reconcile-balance.sh "$ENV_NAME" > balance-after.txt'
          sh '''
            if ! diff -u balance-before.txt balance-after.txt; then
              echo "*** ยอดคงเหลือไม่ตรงกันก่อน/หลัง deploy — ต้อง rollback ทันที ***"
              exit 1
            fi
            echo "ยอดคงเหลือตรงกันทุกบาท"
          '''
        }
      }
      post {
        always { archiveArtifacts artifacts: 'balance-*.txt', allowEmptyArchive: true }
      }
    }

    stage('Smoke test') {
      steps { sh './ci/smoke-test.sh "$ENV_NAME"' }
    }
  }

  post {
    failure {
      echo """
      ===============================================================
       DEPLOY ไม่สำเร็จ — ตัดสินใจ rollback ภายใน 15 นาที
       คำสั่ง:  ./deploy-prod.sh rollback \$(cat .deploy-state/prod.last-image)
       ถ้ามี migration ที่เปลี่ยน schema ต้อง restore จาก backup ด้วย
       แล้วแจ้ง stakeholder + เขียน incident report
      ===============================================================
      """
    }
    always { sh 'docker logout "$REGISTRY" || true' }
  }
}
