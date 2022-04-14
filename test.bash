#!/bin/bash
if [ $# -eq 0 ]; then
  # Override values for the services using the baseline override passed through sed to rename and customize as needed for the target test services.
  # This allows us to only need to configure the override values once and not need duplicates, and/or different files, for each service.
  # The test search-featured-results instance:
  #   Want to toggle logging off for it so it doesn't clutter output.
  docker-compose -f docker-compose.test.yml \
                 -f <(sed -E 's/^#( *(logging|driver):)/\1/' docker-compose.override.yml) \
                 up --build --abort-on-container-exit --exit-code-from search-featured-results-test
else
  # We were passed one or more arguemnts. Interpret that to mean someone wanted response time logging so don't uncomment logging off directives from override.
  docker-compose -f docker-compose.test.yml \
                 -f docker-compose.override.yml \
                 up --build --abort-on-container-exit --exit-code-from search-featured-results-test
fi
