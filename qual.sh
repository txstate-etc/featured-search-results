#!/bin/sh
# Pass version as first argument, defaults to git branch name or git tag if that's not available.
VER="${1:-`git symbolic-ref -q --short HEAD || git describe --tags --exact-match`}"
GITBRANCH=`git symbolic-ref -q --short HEAD`
GITTAG=`git describe --tags --exact-match 2>/dev/null`
COMMIT=$(git rev-parse HEAD)
if [[ "$GITTAG" != "" ]]; then
  echo "Not overwriting existing tag $GITTAG on commit $COMMIT with new tag $VER."
  echo "Aborting build to preserve build tag integrity with commits."
  exit 1
fi
if [ "$VER" = "$GITBRANCH" ]; then
  echo "Not tagging commit $COMMIT on branch $GITBRANCH with tag $VER."
  echo "Aborting build to preserve build tag integrity with commits."
  exit 1
fi
if [ "$VER" = "$GITTAG" ]; then
  echo "Commit $COMMIT is already tagged as $GITTAG."
  echo "Aborting build to preserve build tag integrity with commits."
  exit 1
fi
if `git tag $VER $COMMIT`; then
  echo "Tagged commit $COMMIT on branch $GITBRANCH with tag $VER."
  echo "Proceeding with versioned builds."
else
  echo "Failed to tag commit $COMMIT on branch $GITBRANCH with tag $VER."
  echo "Aborting build to preserve build tag integrity with commits."
  exit 1
fi
docker build -t registry.its.txstate.edu/search-featured-results .
docker tag registry.its.txstate.edu/search-featured-results registry.its.txstate.edu/search-featured-results:$VER
docker push registry.its.txstate.edu/search-featured-results
docker push registry.its.txstate.edu/search-featured-results:$VER
docker build -t registry.its.txstate.edu/search-featured-results-cron -f Dockerfile.cron .
docker tag registry.its.txstate.edu/search-featured-results-cron registry.its.txstate.edu/search-featured-results-cron:$VER
docker push registry.its.txstate.edu/search-featured-results-cron
docker push registry.its.txstate.edu/search-featured-results-cron:$VER
git push origin --tags
