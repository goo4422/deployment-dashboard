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
        BUILD_DATE  = sh(script: 'date -u +%Y-%m-%dT%H:%M:%SZ', returnStdout: true).trim()
        GIT_BRANCH_NAME = 'main'
    }

    stages {

        stage('Checkout') {
            steps {
                echo "Код татаж байна..."
                checkout scm
            }
        }

        stage('Install') {
            steps {
                echo "npm packages суулгаж байна..."
                sh 'npm install'
            }
        }

        stage('Docker Build') {
            steps {
                echo "Docker image build хийж байна..."
                sh """
                    docker build -t ${IMAGE_NAME}:${APP_VERSION} -t ${IMAGE_NAME}:latest .
                """
            }
        }

        stage('Docker Push') {
            steps {
                echo "Docker Hub руу push хийж байна..."
                sh """
                    echo ${DOCKER_HUB_PSW} | docker login -u ${DOCKER_HUB_USR} --password-stdin
                    docker push ${IMAGE_NAME}:${APP_VERSION}
                    docker push ${IMAGE_NAME}:latest
                """
            }
        }

        stage('Deploy to EC2') {
            steps {
                echo "EC2 дээр deploy хийж байна..."
                sh """
                    export APP_VERSION=${APP_VERSION}
                    export DOCKER_IMAGE=${IMAGE_NAME}
                    docker-compose down || true
                    docker-compose pull
                    docker-compose up -d
                    docker image prune -f
                """
            }
        }

        stage('Health Check') {
            steps {
                echo "Health check хийж байна..."
                retry(5) {
                    sleep(time: 5, unit: 'SECONDS')
                    sh 'curl -f http://localhost:3000/health'
                }
            }
        }
    }

    post {
        success {
            echo "✅ DEPLOY АМЖИЛТТАЙ! Version: ${APP_VERSION} | Build: #${BUILD_NUMBER}"
        }
        failure {
            echo "❌ Pipeline амжилтгүй боллоо."
        }
    }
}