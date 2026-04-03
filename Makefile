APP_NAME = deployment-dashboard
VERSION  = $(shell node -p "require('./package.json').version" 2>/dev/null || echo "v1.0.0")
IMAGE    = $(APP_NAME):$(VERSION)

.PHONY: help dev test docker-build docker-run logs stop clean

help:                ## Боломжит командуудыг харуулна
	@grep -E '^[a-zA-Z_-]+:.*##' $(MAKEFILE_LIST) | awk 'BEGIN{FS=":.*##"}{printf "  \033[36m%-15s\033[0m %s\n",$$1,$$2}'

dev:                 ## Local development server ажиллуулна
	npm install && node src/server.js

test:                ## Тестүүд ажиллуулна
	npm test

test-coverage:       ## Coverage тайланг харуулна
	npm test -- --coverage

docker-build:        ## Docker image build хийнэ
	docker build \
		--build-arg APP_VERSION=$(VERSION) \
		--build-arg BUILD_DATE=$(shell date -u +%Y-%m-%dT%H:%M:%SZ) \
		--build-arg GIT_COMMIT=$(shell git rev-parse --short HEAD 2>/dev/null || echo "unknown") \
		-t $(IMAGE) -t $(APP_NAME):latest .

docker-run:          ## Docker Compose-оор эхлүүлнэ
	docker-compose up -d

logs:                ## Container log харуулна
	docker-compose logs -f

stop:                ## Container зогсооно
	docker-compose down

clean:               ## Container болон volume-уудыг устгана
	docker-compose down -v --remove-orphans
	docker image prune -f
