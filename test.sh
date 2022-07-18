#!/bin/sh
if [ $# -eq 0 ]; then
  # --attach to suppress logging output from other containers.
  docker compose -f docker-compose.test.yml \
                 -f docker-compose.override.yml \
                 up --build --force-recreate --remove-orphans --abort-on-container-exit --attach search-featured-results-test
else
  # We were passed one or more arguments. Interpret that to mean someone wanted response time logging so don't uncomment logging off directives from override.
  docker compose -f docker-compose.test.yml \
                 -f docker-compose.override.yml \
                 up --build --force-recreate --remove-orphans --abort-on-container-exit --exit-code-from search-featured-results-test
fi
