pipeline {
    agent any

    environment {
        APP_NAME    = 'deployment-dashboard'
        DOCKER_HUB  = credentials('dockerhub-credentials')  // Jenkins-д нэмнэ
        IMAGE_NAME  = "${DOCKER_HUB_USR}/${APP_NAME}"
        APP_VERSION = "v${BUILD_NUMBER}"
        BUILD_DATE  = sh(script: 'date -u +%Y-%m-%dT%H:%M:%SZ', returnStdout: true).trim()
        GIT_BRANCH_NAME = "${GIT_BRANCH?.replaceAll('origin/', '') ?: 'main'}"
    }

    stages {

        stage('🔍 Checkout') {
            steps {
                echo "📥 Код татаж байна... Branch: ${GIT_BRANCH_NAME}"
                checkout scm
            }
        }

        stage('📦 Install Dependencies') {
            steps {
                echo "📦 npm packages суулгаж байна..."
                sh 'npm install'
            }
        }

        stage('🧪 Run Tests') {
            steps {
                echo "🧪 Тест ажиллуулж байна..."
                sh 'npm test'
            }
            post {
                always {
                    // Test report хадгална
                    junit allowEmptyResults: true, testResults: 'test-results/*.xml'
                }
            }
        }

        stage('🐳 Docker Build') {
            steps {
                echo "🐳 Docker image build хийж байна: ${IMAGE_NAME}:${APP_VERSION}"
                sh """
                    docker build \
                        --build-arg APP_VERSION=${APP_VERSION} \
                        -t ${IMAGE_NAME}:${APP_VERSION} \
                        -t ${IMAGE_NAME}:latest \
                        .
                """
            }
        }

        stage('🚀 Docker Push') {
            steps {
                echo "🚀 Docker Hub руу push хийж байна..."
                sh """
                    echo ${DOCKER_HUB_PSW} | docker login -u ${DOCKER_HUB_USR} --password-stdin
                    docker push ${IMAGE_NAME}:${APP_VERSION}
                    docker push ${IMAGE_NAME}:latest
                """
            }
        }

        stage('☁️ Deploy to EC2') {
            steps {
                echo "☁️ EC2 дээр deploy хийж байна..."
                sh """
                    export APP_VERSION=${APP_VERSION}
                    export BUILD_NUMBER=${BUILD_NUMBER}
                    export BUILD_DATE=${BUILD_DATE}
                    export GIT_BRANCH=${GIT_BRANCH_NAME}
                    export GIT_COMMIT=${GIT_COMMIT}
                    export DOCKER_IMAGE=${IMAGE_NAME}

                    # Хуучин container зогсооно
                    docker-compose down || true

                    # Шинэ image татаж, container эхлүүлнэ
                    docker-compose pull
                    docker-compose up -d

                    # Хуучин image устгана
                    docker image prune -f
                """
            }
        }

        stage('✅ Health Check') {
            steps {
                echo "✅ Health check хийж байна..."
                retry(5) {
                    sleep(time: 5, unit: 'SECONDS')
                    sh 'curl -f http://localhost:3000/health'
                }
            }
        }
    }

    post {
        success {
            echo """
            ╔══════════════════════════════════════╗
            ║  ✅ DEPLOY АМЖИЛТТАЙ БОЛЛОО!         ║
            ║  Version : ${APP_VERSION}             
            ║  Build   : #${BUILD_NUMBER}           
            ║  Branch  : ${GIT_BRANCH_NAME}         
            ╚══════════════════════════════════════╝
            """
        }
        failure {
            echo "❌ Pipeline амжилтгүй боллоо. Log-г шалгана уу."
        }
        always {
            // Docker login session цэвэрлэнэ
            sh 'docker logout || true'
        }
    }
}
