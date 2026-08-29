SHELL := /bin/bash
.SHELLFLAGS := -ec

.PHONY: test build diagrams-check verify

test:
	npm run docs:test

build:
	npm run docs:build

diagrams-check:
	npm run docs:diagrams:check

verify: diagrams-check test build
