#!/bin/sh
# Pass version as first argument, defaults to git branch name or git tag if that's not available.
VER="${1:-`git symbolic-ref -q --short HEAD || git describe --tags --exact-match`}"
docker build -t registry.its.txstate.edu/search-featured-results:$VER .
docker push registry.its.txstate.edu/search-featured-results:$VER
docker build -t registry.its.txstate.edu/search-featured-results-cron:$VER -f Dockerfile.cron .
docker push registry.its.txstate.edu/search-featured-results-cron:$VER
