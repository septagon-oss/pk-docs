SHELL := /bin/bash
.SHELLFLAGS := -ec

.PHONY: test

test:
	npm run docs:test
