pipeline {
    agent any

    tools {
        nodejs 'nodejs'
    }

    options {
        timeout(time: 30, unit: 'MINUTES')
        buildDiscarder(logRotator(numToKeepStr: '10'))
        disableConcurrentBuilds()
        timestamps()
    }

    environment {
        APP_NAME   = 'deployment-dashboard'
        DOCKER_HUB = credentials('dockerhub-credentials')
        IMAGE_NAME = "${DOCKER_HUB_USR}/${APP_NAME}"
        EC2_HOST   = '52.77.214.21'
        EC2_USER   = 'ubuntu'
        APP_PORT   = '3000'
    }

    stages {

        stage('Checkout') {
            steps {
                checkout scm
                script {
                    env.BUILD_DATE       = sh(script: 'date -u +%Y-%m-%dT%H:%M:%SZ', returnStdout: true).trim()
                    env.GIT_COMMIT_SHORT = sh(script: 'git rev-parse --short HEAD', returnStdout: true).trim()
                    env.APP_VERSION      = "v${BUILD_NUMBER}"
                    // Detached HEAD үед Jenkins-ийн өөрийн env хувьсагчаас авна
                    def rawBranch = env.BRANCH_NAME ?: env.GIT_BRANCH ?: ''
                    env.GIT_BRANCH_NAME  = rawBranch.replaceAll('origin/', '') ?: 'main'
                }
                echo "Build: #${BUILD_NUMBER} | ${APP_VERSION} | ${GIT_BRANCH_NAME}@${GIT_COMMIT_SHORT}"
            }
        }

        stage('Install') {
            steps {
                sh 'npm ci'
            }
        }

        stage('Test') {
            steps {
                sh 'npm test'
            }
            post {
                failure {
                    echo "Тест амжилтгүй — pipeline зогсоов."
                }
            }
        }

        stage('Docker Build & Push') {
            steps {
                sh """
                    export PATH=/opt/homebrew/bin:\$PATH
                    echo ${DOCKER_HUB_PSW} | docker login -u ${DOCKER_HUB_USR} --password-stdin
                    docker buildx build --platform linux/amd64 \\
                        --build-arg APP_VERSION=${APP_VERSION} \\
                        --build-arg BUILD_DATE=${BUILD_DATE} \\
                        --build-arg GIT_COMMIT=${GIT_COMMIT_SHORT} \\
                        -t ${IMAGE_NAME}:${APP_VERSION} \\
                        -t ${IMAGE_NAME}:latest \\
                        --push .
                    docker logout
                """
            }
        }

        stage('Deploy to EC2') {
            when {
                expression { env.GIT_BRANCH_NAME == 'main' || env.GIT_BRANCH_NAME == 'master' }
            }
            steps {
                echo "EC2 дээр deploy хийж байна: ${EC2_USER}@${EC2_HOST}"
                sshagent(['ec2-ssh']) {
                    sh """
                        ssh -o StrictHostKeyChecking=no ${EC2_USER}@${EC2_HOST} '
                            # Rollback-д зориулж одоогийн image-г хадгална
                            PREV_IMAGE=\$(docker inspect dashboard-app --format="{{.Config.Image}}" 2>/dev/null || echo "none")
                            echo "Previous image: \$PREV_IMAGE"
                            echo "\$PREV_IMAGE" > /tmp/prev-dashboard-image.txt

                            echo "[1/4] Шинэ image татаж байна..."
                            docker pull ${IMAGE_NAME}:latest

                            echo "[2/4] Хуучин container зогсооно..."
                            docker stop dashboard-app 2>/dev/null || true
                            docker rm   dashboard-app 2>/dev/null || true

                            echo "[3/4] Шинэ container эхлүүлнэ..."
                            docker run -d --name dashboard-app \\
                                --restart unless-stopped \\
                                -p ${APP_PORT}:3000 \\
                                -v dashboard-data:/app/data \\
                                -e APP_VERSION=${APP_VERSION} \\
                                -e BUILD_NUMBER=${BUILD_NUMBER} \\
                                -e BUILD_DATE=${BUILD_DATE} \\
                                -e GIT_BRANCH=${GIT_BRANCH_NAME} \\
                                -e GIT_COMMIT=${GIT_COMMIT_SHORT} \\
                                -e NODE_ENV=production \\
                                -e DOCKER_IMAGE=${IMAGE_NAME}:${APP_VERSION} \\
                                ${IMAGE_NAME}:latest

                            echo "[4/4] Хуучин image-уудыг цэвэрлэнэ..."
                            docker image prune -f
                        '
                    """
                }
            }
        }

        stage('Health Check') {
            when {
                expression { env.GIT_BRANCH_NAME == 'main' || env.GIT_BRANCH_NAME == 'master' }
            }
            steps {
                script {
                    try {
                        retry(10) {
                            sleep(time: 10, unit: 'SECONDS')
                            sh "curl -sf http://${EC2_HOST}:${APP_PORT}/health | grep -q 'ok'"
                        }
                        echo "Health check амжилттай — апп ажиллаж байна."
                    } catch (err) {
                        echo "Health check амжилтгүй — автомат rollback эхэлж байна..."
                        sshagent(['ec2-ssh']) {
                            sh """
                                ssh -o StrictHostKeyChecking=no ${EC2_USER}@${EC2_HOST} '
                                    PREV_IMAGE=\$(cat /tmp/prev-dashboard-image.txt 2>/dev/null || echo "none")
                                    if [ "\$PREV_IMAGE" != "none" ] && [ "\$PREV_IMAGE" != "" ]; then
                                        echo "Rollback: \$PREV_IMAGE рүү буцаж байна..."
                                        docker stop dashboard-app 2>/dev/null || true
                                        docker rm   dashboard-app 2>/dev/null || true
                                        docker run -d --name dashboard-app \\
                                            --restart unless-stopped \\
                                            -p ${APP_PORT}:3000 \\
                                            -v dashboard-data:/app/data \\
                                            -e NODE_ENV=production \\
                                            "\$PREV_IMAGE"
                                        echo "Rollback амжилттай: \$PREV_IMAGE"
                                    else
                                        echo "Rollback хийх өмнөх image олдсонгүй."
                                    fi
                                '
                            """
                        }
                        error("Health check амжилтгүй — өмнөх хувилбарт rollback хийгдлээ.")
                    }
                }
            }
        }

    }

    post {
        success {
            echo """
+--------------------------------------------------+
|  DEPLOY АМЖИЛТТАЙ                                |
+--------------------------------------------------+
|  Version : ${APP_VERSION}
|  Build   : #${BUILD_NUMBER}
|  Commit  : ${GIT_COMMIT_SHORT}
|  Branch  : ${GIT_BRANCH_NAME}
|  Date    : ${BUILD_DATE}
|  URL     : http://${EC2_HOST}:${APP_PORT}
+--------------------------------------------------+
"""
        }
        failure {
            echo "Pipeline амжилтгүй — Build #${BUILD_NUMBER} | ${GIT_COMMIT_SHORT}"
        }
        always {
            cleanWs()
        }
    }
}
