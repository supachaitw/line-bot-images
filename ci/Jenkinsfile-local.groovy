// =============================================================================
//  TANACHOK — Pipeline สำหรับซ้อมบนเครื่อง local
//  สายงาน: GitLab (local) -> Jenkins (local) -> build image -> รันเว็บเพื่อทดสอบ
//
//  ใช้โครงเดียวกับ Jenkinsfile-sit.groovy ของธนาคาร แต่ตัดส่วนที่ต้องใช้
//  ระบบของธนาคารออก (Nexus, ฐานข้อมูล, Security scan) เพื่อให้รันจบได้ในเครื่องเดียว
//
//  ตั้งค่าใน Jenkins:
//    Pipeline script from SCM -> Git -> http://gitlab/<group>/tanachok.git
//    Script Path: ci/Jenkinsfile-local.groovy
// =============================================================================

pipeline {
  agent any

  options {
    timestamps()
    disableConcurrentBuilds()
    buildDiscarder(logRotator(numToKeepStr: '20'))
    timeout(time: 20, unit: 'MINUTES')
  }

  parameters {
    string(name: 'TAG_VERSION', defaultValue: 'v0.1.00',
           description: 'Tag version ที่จะ build (รูปแบบ vx.x.xx)')
    string(name: 'APP_PORT', defaultValue: '8802',
           description: 'พอร์ตที่จะเปิดเว็บให้ทดสอบ')
  }

  environment {
    IMAGE_REPO = 'tanachok-web'
    APP_PORT   = "${params.APP_PORT}"
  }

  stages {

    stage('ตรวจ Tag version') {
      steps {
        script {
          if (!(params.TAG_VERSION ==~ /^v[0-9]+\.[0-9]+\.[0-9]+(\.[0-9]+)?$/)) {
            error "รูปแบบ Tag ไม่ถูกต้อง: ${params.TAG_VERSION} (ต้องเป็น vx.x.xx)"
          }
        }
      }
    }

    stage('Checkout') {
      steps {
        checkout scm
        sh 'git log -1 --oneline'
      }
    }

    stage('ตรวจไฟล์ก่อน build') {
      steps {
        sh './ci/run-tests.sh'
      }
    }

    stage('Build image') {
      steps {
        sh "IMAGE_TAG=${params.TAG_VERSION} ./deploy-local.sh build-only"
      }
    }

    stage('Deploy') {
      steps {
        sh "./deploy-local.sh deploy-only ${params.TAG_VERSION}"
      }
    }

    stage('Health check') {
      steps {
        sh './deploy-local.sh health'
      }
    }

    stage('ตรวจว่า version ที่ขึ้นตรงกับ tag') {
      steps {
        script {
          // กติกาของธนาคาร: หลัง deploy ต้องตรวจสอบ version ที่ deploy ได้
          def deployed = sh(returnStdout: true, script: """
            curl -sf http://localhost:${env.APP_PORT}/version \
              | sed -n 's/.*"version":"\\([^"]*\\)".*/\\1/p'
          """).trim()
          if (deployed != params.TAG_VERSION) {
            error "version ที่ขึ้นจริง (${deployed}) ไม่ตรงกับ tag (${params.TAG_VERSION})"
          }
          echo "ยืนยันแล้ว: กำลังรัน ${deployed}"
        }
      }
    }

    stage('Smoke test') {
      steps {
        sh './ci/smoke-test.sh local'
      }
    }
  }

  post {
    success {
      echo """
      ==========================================================
       สำเร็จ — เปิดเว็บทดสอบได้ที่ http://localhost:${env.APP_PORT}
         /            หน้าจอตัวอย่างโหมดจ่ายคืน (มีป้ายแสดง version มุมขวาล่าง)
         /tanachok-system-review.html   เอกสารรีวิวฉบับรวม
         /version     ตรวจ version ที่ deploy
      ==========================================================
      """
    }
    failure {
      echo 'ไม่สำเร็จ — ดู log แล้วลอง ./deploy-local.sh logs'
    }
  }
}
