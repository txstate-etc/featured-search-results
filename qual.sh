#!/bin/sh
# Pass version as first argument, defaults to git branch name or git tag if that's not available.
docker build -t registry.its.txstate.edu/search-featured-results .
docker push registry.its.txstate.edu/search-featured-results
docker build -t registry.its.txstate.edu/search-featured-results-cron -f Dockerfile.cron .
docker push registry.its.txstate.edu/search-featured-results-cron
VER="${1:-`git symbolic-ref -q --short HEAD || git describe --tags --exact-match`}"
GITBRANCH=`git symbolic-ref -q --short HEAD`
GITTAG=`git describe --tags --exact-match`
COMMIT=$(git rev-parse HEAD)
if [ "$2" = "tag" ]; then
  if [ "$GITTAG" = "$VER" ]; then
    echo "Not tagging commit $COMMIT on branch $GITBRANCH with existing tag $GITTAG as new tag $VER"
    exit 0
  fi
  echo "Tagging commit $COMMIT on branch $GITBRANCH with tag $VER"
  git tag $VER $COMMIT
  git push origin --tags
else
  echo "Not tagging commit $COMMIT on branch $GITBRANCH with existing tag $GITTAG as new tag $VER"
fi
