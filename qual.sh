#!/bin/bash
# Pass version as first argument - REQUIRED.
#VER="${1:-`git symbolic-ref -q --short HEAD || git describe --tags --exact-match`}"
VER=$1
getNPMVer () {
  npm pkg get version | sed -e 's/^"//' -e 's/"$//'
}
integrityExit () {
  echo "$1"
  echo "Aborting build to preserve build tag integrity with commits." && exit 1
}
# Our in-house convention is that version tags should not be prefixed and should
# match across git, npm, and build images. To avoid all sorts of problems in
# tagging with `npm version` - if it's not empty, we'll try setting it to empty
# or abort the build with the config opened for manual editing so the user can
# set it to an empty value manually.
if [ `npm config get tag-version-prefix` != "" ]; then
  echo "NPM tag-version-prefix is not blank."
  echo "Setting NPM tag-version-prefix to ''..."
  npm config set tag-version-prefix ''
  if [ `npm config get tag-version-prefix` = "" ]; then
    echo "NPM tag-version-prefix is now set to ''."
  else
    echo "The command,"
    echo "  npm config set tag-version-prefix ''"
    echo ", is currently broken. Opening npm's config in manual edit mode..."
    npm config edit --editor code
    integrityExit "Please set npm's tag-version-prefix to '' and try again."
  fi
fi
GITBRANCH=`git symbolic-ref -q --short HEAD`
GITTAG=`git describe --tags --exact-match 2>/dev/null`
COMMIT=$(git rev-parse HEAD)
cd `git rev-parse --show-toplevel` # cd to repo root.
IMAGENAME=`basename $(pwd)`
if [ -f ./package.json ]; then
  NPMVER=`getNPMVer`
fi
echo "Build Tag: $VER"
echo "NPM-Ver:   $NPMVER"
echo "Branch:    $GITBRANCH"
echo "Git Tag:   $GITTAG"
echo Commit: $COMMIT
echo Image Name: $IMAGENAME
echo
# Ensure they've already updated their npm version to match what they want to tag the build with.
if [[ "$NPMVER" != "" && "$VER" != "$NPMVER" ]]; then
  integrityExit "The version in your npm package.json file does not match the build tag passed.
Please run the following command to update your package version and commit those changes before attempting to build:

    npm version $VER
"
fi
# Ensure we're building from committed changes.
if `git diff-index --quiet HEAD --`; then
  echo "Active branch $GITBRANCH is clean. Continuing with checks..."
else
  integrityExit "Active branch $GITBRANCH is dirty. Please commit changes to associate with build."
fi
# Ensure we're tagging with a version and not a branch name.
if [ "$VER" = "$GITBRANCH" ]; then
   integrityExit "Not tagging commit $COMMIT on branch $GITBRANCH with tag $GITBRANCH. Please provide a versioning argument."
fi
## Ensure our version paramenter is not in conflict with an existing commit tag.
#if [[ "$GITTAG" != "" && "$GITTAG" != "v$VER" ]]; then
#  integrityExit "Not overwriting existing tag $GITTAG on commit $COMMIT with new tag $VER."
#fi
# Ensure we're able to tag the commit with the version.
if [[ "$VER" = "$GITTAG" || "v$VER" = "$GITTAG" ]]; then
  echo "Commit $COMMIT is already tagged as $GITTAG."
else
  integrityExit "Please tag current commit"
#  if `git tag $VER $COMMIT`; then
#    echo "Tagged commit $COMMIT on branch $GITBRANCH with tag $VER."
#  else
#    integrityExit "Failed to tag commit $COMMIT on branch $GITBRANCH with tag $VER."
#  fi
fi
echo "Proceeding with versioned builds..."
docker build -t registry.its.txstate.edu/$IMAGENAME .
docker tag registry.its.txstate.edu/$IMAGENAME registry.its.txstate.edu/$IMAGENAME:$VER
PUSH_STATUS=$(docker push registry.its.txstate.edu/$IMAGENAME:latest --quiet)
if [[ "$PUSH_STATUS" = "registry.its.txstate.edu/$IMAGENAME:latest" ]]; then
  echo "Pushed latest build to registry.its.txstate.edu/$IMAGENAME."
else
  integrityExit "Failed to push latest build to registry.its.txstate.edu/$IMAGENAME.
Please resolve the issues preventing the push and try again with the following command:

    docker push registry.its.txstate.edu/$IMAGENAME:latest
"
fi
PUSH_STATUS=$(docker push registry.its.txstate.edu/$IMAGENAME:$VER --quiet)
if [[ "$PUSH_STATUS" = "registry.its.txstate.edu/$IMAGENAME:$VER" ]]; then
  echo "Pushed tagged build to registry.its.txstate.edu/$IMAGENAME:$VER."
else
  integrityExit "Failed to push tagged build to registry.its.txstate.edu/$IMAGENAME:$VER.
Please resolve the issues preventing the push and try again with the following command:

    docker push registry.its.txstate.edu/$IMAGENAME:$VER
"
fi
docker build -t registry.its.txstate.edu/$IMAGENAME-cron -f Dockerfile.cron .
docker tag registry.its.txstate.edu/$IMAGENAME-cron registry.its.txstate.edu/$IMAGENAME-cron:$VER
PUSH_STATUS=$(docker push registry.its.txstate.edu/$IMAGENAME-cron:latest --quiet)
if [[ "$PUSH_STATUS" = "registry.its.txstate.edu/$IMAGENAME-cron:latest" ]]; then
  echo "Pushed latest build to registry.its.txstate.edu/$IMAGENAME-cron."
else
  integrityExit "Failed to push latest build to registry.its.txstate.edu/$IMAGENAME-cron.
Please resolve the issues preventing the push and try again with the following command:

    docker push registry.its.txstate.edu/$IMAGENAME-cron:latest
"
fi
PUSH_STATUS=$(docker push registry.its.txstate.edu/$IMAGENAME-cron:$VER --quiet)
if [[ "$PUSH_STATUS" = "registry.its.txstate.edu/$IMAGENAME-cron:$VER" ]]; then
  echo "Pushed tagged build to registry.its.txstate.edu/$IMAGENAME-cron:$VER."
else
  integrityExit "Failed to push tagged build to registry.its.txstate.edu/$IMAGENAME-cron:$VER.
Please resolve the issues preventing the push and try again with the following command:

    docker push registry.its.txstate.edu/$IMAGENAME-cron:$VER
"
fi
git push origin --tags
