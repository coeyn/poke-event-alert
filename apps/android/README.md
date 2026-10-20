# Android preview

This Trusted Web Activity opens the deployed PWA at `https://coeyn.github.io/poke-event-alert/`.
The website remains the source of app content and updates.

Push `android-preview-v*` to build a debug-signed APK and attach it to a prerelease on GitHub.
The APK is for preview and testing only. The GitHub Actions debug signing key is not persistent;
installing a later build over it may require uninstalling the earlier APK. Set up a persistent
release signing key in GitHub Actions secrets before publishing on Google Play.

The GitHub Pages project site shares the `coeyn.github.io` origin. It cannot publish its own
origin-level `/.well-known/assetlinks.json`, so Android may display Chrome's custom tab toolbar
instead of a verified fullscreen Trusted Web Activity.
