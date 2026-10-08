#!/bin/sh
# Runs the Playwright suite in docker against a self-contained stack (app + mongo + fakeauth).
# By default only the test runner's output is attached. Pass any argument (e.g. `./test.sh show`)
# to attach log output from all the containers - useful for debugging the app under test.
PROJECT="$(basename "$PWD" | tr '[:upper:]' '[:lower:]')-test"
override=''
if [ -e docker-compose.test.override.yml ]; then
  override='-f docker-compose.test.override.yml'
fi

if [ $# -eq 0 ]; then
  docker compose -p "$PROJECT" -f docker-compose.test.yml $override \
    up --build --force-recreate --remove-orphans \
    --abort-on-container-exit --exit-code-from search-featured-results-test \
    --attach search-featured-results-test
else
  docker compose -p "$PROJECT" -f docker-compose.test.yml $override \
    up --build --force-recreate --remove-orphans \
    --abort-on-container-exit --exit-code-from search-featured-results-test
fi
EXITCODE=$?

docker compose -p "$PROJECT" -f docker-compose.test.yml $override down -v --remove-orphans > /dev/null 2>&1

exit $EXITCODE
