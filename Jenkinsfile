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
        EC2_HOST   = '47.128.145.46'
        EC2_USER   = 'ubuntu'
        APP_PORT   = '3000'
    }

    stages {

        stage('Checkout') {
            steps {
                script {
                    def t = System.currentTimeMillis()
                    checkout scm
                    env.BUILD_DATE       = sh(script: 'date -u +%Y-%m-%dT%H:%M:%SZ', returnStdout: true).trim()
                    env.GIT_COMMIT_SHORT = sh(script: 'git rev-parse --short HEAD', returnStdout: true).trim()
                    env.APP_VERSION      = "v${BUILD_NUMBER}"
                    def rawBranch = env.BRANCH_NAME ?: env.GIT_BRANCH ?: ''
                    env.GIT_BRANCH_NAME  = rawBranch.replaceAll('origin/', '') ?: 'main'
                    env.DURATION_CHECKOUT = "${((System.currentTimeMillis() - t) / 1000).toInteger()}"
                }
                echo "Build: #${BUILD_NUMBER} | ${APP_VERSION} | ${GIT_BRANCH_NAME}@${GIT_COMMIT_SHORT}"
            }
        }

        stage('Install') {
            steps {
                script {
                    def t = System.currentTimeMillis()
                    sh 'npm ci'
                    env.DURATION_INSTALL = "${((System.currentTimeMillis() - t) / 1000).toInteger()}"
                }
            }
        }

        stage('Test') {
            steps {
                script {
                    def t = System.currentTimeMillis()
                    sh 'npm test'
                    env.DURATION_TEST = "${((System.currentTimeMillis() - t) / 1000).toInteger()}"
                }
            }
            post {
                failure {
                    echo "Тест амжилтгүй — pipeline зогсоов."
                }
            }
        }

        stage('Docker Build & Push') {
            steps {
                script {
                    // Build: login + buildx builder тохиргоо
                    def tBuild = System.currentTimeMillis()
                    env.TEMP_DOCKER_CONFIG = sh(script: 'mktemp -d', returnStdout: true).trim()
                    sh '''
                        export PATH=/opt/homebrew/bin:$PATH
                        cp -r $HOME/.docker/. $TEMP_DOCKER_CONFIG/ 2>/dev/null || true
                        printf '{"auths":{}}' > $TEMP_DOCKER_CONFIG/config.json
                        export DOCKER_CONFIG=$TEMP_DOCKER_CONFIG
                        echo $DOCKER_HUB_PSW | docker login -u $DOCKER_HUB_USR --password-stdin
                        docker buildx create --name cicd-builder --driver docker-container --use 2>/dev/null || docker buildx use cicd-builder
                        docker buildx inspect cicd-builder --bootstrap
                    '''
                    env.DURATION_BUILD = "${((System.currentTimeMillis() - tBuild) / 1000).toInteger()}"

                    // Docker: image build + registry push
                    def tDocker = System.currentTimeMillis()
                    sh '''
                        export PATH=/opt/homebrew/bin:$PATH
                        export DOCKER_CONFIG=$TEMP_DOCKER_CONFIG
                        docker buildx build --no-cache --platform linux/amd64 \
                            --build-arg APP_VERSION=$APP_VERSION \
                            --build-arg BUILD_DATE=$BUILD_DATE \
                            --build-arg GIT_COMMIT=$GIT_COMMIT_SHORT \
                            -t $IMAGE_NAME:$APP_VERSION \
                            -t $IMAGE_NAME:latest \
                            --push .
                        docker logout
                    '''
                    env.DURATION_DOCKER = "${((System.currentTimeMillis() - tDocker) / 1000).toInteger()}"
                }
            }
        }

        stage('Deploy to EC2') {
            when {
                expression { env.GIT_BRANCH_NAME == 'main' || env.GIT_BRANCH_NAME == 'master' }
            }
            steps {
                script {
                    def t = System.currentTimeMillis()
                    echo "EC2 дээр deploy хийж байна: ${EC2_USER}@${EC2_HOST}"
                    sshagent(['ec2-ssh']) {
                        sh """
                            ssh -o StrictHostKeyChecking=no ${EC2_USER}@${EC2_HOST} '
                                # Хуучин image ID-г хадгална (tag биш, ID ашиглана — prune-д устахгүй)
                                PREV_ID=\$(docker inspect dashboard-app --format="{{.Image}}" 2>/dev/null || echo "none")
                                echo "Previous image ID: \$PREV_ID"
                                echo "\$PREV_ID" > /tmp/prev-dashboard-image.txt

                                # Rollback-д зориулж тусдаа tag хийнэ (pull-н өмнө)
                                if [ "\$PREV_ID" != "none" ] && [ -n "\$PREV_ID" ]; then
                                    docker tag "\$PREV_ID" ${IMAGE_NAME}:rollback 2>/dev/null || true
                                fi

                                echo "[1/3] Шинэ image татаж байна..."
                                docker pull ${IMAGE_NAME}:latest

                                echo "[2/3] Хуучин container зогсооно..."
                                docker stop dashboard-app 2>/dev/null || true
                                docker rm   dashboard-app 2>/dev/null || true

                                echo "[3/3] Шинэ container эхлүүлнэ..."
                                DOCKER_GID=\$(stat -c '%g' /var/run/docker.sock)
                                docker run -d --name dashboard-app \\
                                    --restart unless-stopped \\
                                    --group-add \$DOCKER_GID \\
                                    -p ${APP_PORT}:3000 \\
                                    -v dashboard-data:/app/data \\
                                    -v /var/run/docker.sock:/var/run/docker.sock \\
                                    -e APP_VERSION=${APP_VERSION} \\
                                    -e BUILD_NUMBER=${BUILD_NUMBER} \\
                                    -e BUILD_DATE=${BUILD_DATE} \\
                                    -e GIT_BRANCH=${GIT_BRANCH_NAME} \\
                                    -e GIT_COMMIT=${GIT_COMMIT_SHORT} \\
                                    -e NODE_ENV=production \\
                                    -e DOCKER_IMAGE=${IMAGE_NAME}:${APP_VERSION} \\
                                    -e DURATION_CHECKOUT=${DURATION_CHECKOUT} \\
                                    -e DURATION_INSTALL=${DURATION_INSTALL} \\
                                    -e DURATION_TEST=${DURATION_TEST} \\
                                    -e DURATION_BUILD=${DURATION_BUILD} \\
                                    -e DURATION_DOCKER=${DURATION_DOCKER} \\
                                    ${IMAGE_NAME}:latest
                            '
                        """
                    }
                    env.DURATION_DEPLOY = "${((System.currentTimeMillis() - t) / 1000).toInteger()}"
                }
            }
        }

        stage('Health Check') {
            when {
                expression { env.GIT_BRANCH_NAME == 'main' || env.GIT_BRANCH_NAME == 'master' }
            }
            steps {
                script {
                    def t = System.currentTimeMillis()
                    try {
                        retry(10) {
                            sleep(time: 10, unit: 'SECONDS')
                            sh "curl -sf http://${EC2_HOST}:${APP_PORT}/health | grep -q 'ok'"
                        }
                        env.DURATION_HEALTH = "${((System.currentTimeMillis() - t) / 1000).toInteger()}"
                        echo "Health check амжилттай — апп ажиллаж байна."
                        // Зөвхөн амжилттай болсон үед л хуучин image-уудыг цэвэрлэнэ
                        sshagent(['ec2-ssh']) {
                            sh """
                                ssh -o StrictHostKeyChecking=no ${EC2_USER}@${EC2_HOST} '
                                    docker rmi ${IMAGE_NAME}:rollback 2>/dev/null || true
                                    docker image prune -f
                                '
                            """
                        }
                    } catch (err) {
                        env.DURATION_HEALTH = "${((System.currentTimeMillis() - t) / 1000).toInteger()}"
                        echo "Health check амжилтгүй — автомат rollback эхэлж байна..."
                        sshagent(['ec2-ssh']) {
                            sh """
                                ssh -o StrictHostKeyChecking=no ${EC2_USER}@${EC2_HOST} '
                                    PREV_ID=\$(cat /tmp/prev-dashboard-image.txt 2>/dev/null || echo "none")
                                    if [ "\$PREV_ID" != "none" ] && [ -n "\$PREV_ID" ]; then
                                        echo "Rollback: \$PREV_ID рүү буцаж байна..."
                                        docker stop dashboard-app 2>/dev/null || true
                                        docker rm   dashboard-app 2>/dev/null || true
                                        DOCKER_GID=\$(stat -c '%g' /var/run/docker.sock)
                                        docker run -d --name dashboard-app \\
                                            --restart unless-stopped \\
                                            --group-add \$DOCKER_GID \\
                                            -p ${APP_PORT}:3000 \\
                                            -v dashboard-data:/app/data \\
                                            -v /var/run/docker.sock:/var/run/docker.sock \\
                                            -e NODE_ENV=production \\
                                            "\$PREV_ID"
                                        echo "Rollback амжилттай: \$PREV_ID"
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
