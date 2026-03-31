pipeline {
    agent any

    tools {
        nodejs 'nodejs'
    }

    environment {
        APP_NAME    = 'deployment-dashboard'
        DOCKER_HUB  = credentials('dockerhub-credentials')
        IMAGE_NAME  = "${DOCKER_HUB_USR}/${APP_NAME}"
        APP_VERSION = "v${BUILD_NUMBER}"
        GIT_BRANCH_NAME = 'main'
    }

    stages {

        stage('Checkout') {
            steps {
                echo "Код татаж байна..."
                checkout scm
                script {
                    env.BUILD_DATE = sh(
                        script: 'date -u +%Y-%m-%dT%H:%M:%SZ',
                        returnStdout: true
                    ).trim()
                }
                echo "Build date: ${BUILD_DATE}"
            }
        }

        stage('Install') {
            steps {
                echo "npm packages суулгаж байна..."
                sh 'npm install'
            }
        }

        stage('Test') {
            steps {
                echo "Тестүүд ажиллуулж байна..."
                sh 'npm test'
            }
            post {
                failure {
                    echo "❌ Тест амжилтгүй боллоо — deploy зогсоов."
                }
            }
        }

        stage('Docker Build & Push') {
            steps {
                echo "Docker image build & push хийж байна..."
                sh """
                    export PATH=/opt/homebrew/bin:\$PATH
                    echo ${DOCKER_HUB_PSW} | docker login -u ${DOCKER_HUB_USR} --password-stdin
                    docker buildx build --platform linux/amd64 \\
                        -t ${IMAGE_NAME}:${APP_VERSION} \\
                        -t ${IMAGE_NAME}:latest \\
                        --push .
                """
            }
        }

        stage('Deploy to EC2') {
            steps {
                echo "EC2 дээр deploy хийж байна..."
                sshagent(['ec2-ssh']) {
                    sh """
                        ssh -o StrictHostKeyChecking=no ubuntu@18.141.35.169 '
                            docker pull ${IMAGE_NAME}:latest
                            docker stop dashboard-app || true
                            docker rm dashboard-app || true
                            docker run -d --name dashboard-app -p 3000:3000 \\
                                -v dashboard-data:/app/data \\
                                -e APP_VERSION=${APP_VERSION} \\
                                -e BUILD_NUMBER=${BUILD_NUMBER} \\
                                -e BUILD_DATE=${BUILD_DATE} \\
                                -e GIT_BRANCH=${GIT_BRANCH_NAME} \\
                                -e GIT_COMMIT=${GIT_COMMIT} \\
                                -e NODE_ENV=production \\
                                -e DOCKER_IMAGE=${IMAGE_NAME}:${APP_VERSION} \\
                                ${IMAGE_NAME}:latest
                        '
                    """
                }
            }
        }

        stage('Health Check') {
            steps {
                echo "Health check хийж байна..."
                retry(10) {
                    sleep(time: 10, unit: 'SECONDS')
                    sh 'curl -f http://18.141.35.169:3000/health'
                }
            }
        }

    }

    post {
        success {
            echo "✅ DEPLOY АМЖИЛТТАЙ! Version: ${APP_VERSION} | Build: #${BUILD_NUMBER} | Date: ${BUILD_DATE}"
        }
        failure {
            echo "❌ Pipeline амжилтгүй боллоо. Build: #${BUILD_NUMBER}"
        }
    }
}
