SHELL := /bin/bash
.SHELLFLAGS := -ec

.PHONY: test build verify

test:
	npm run docs:test

build:
	npm run docs:build

verify: test build
