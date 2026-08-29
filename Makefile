SHELL := /bin/bash
.SHELLFLAGS := -ec

.PHONY: test build diagrams-check archify-check verify

test:
	npm run docs:test

build:
	npm run docs:build

diagrams-check:
	npm run docs:diagrams:check

archify-check:
	npm run docs:archify:check

verify: diagrams-check archify-check test build
