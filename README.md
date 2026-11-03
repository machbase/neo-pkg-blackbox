# neo-pkg-blackbox v1.0

A video monitoring package for Machbase Neo that combines server setup, camera management, detection settings, and event review in a single web UI.

## Version Compatibility

Package 1.0.9 targets Machbase Neo 8.5.x and installs native bbox v0.2.5.
The installer uses that exact release, never `latest`. A failed download stops
installation without substituting another version. For Machbase Neo 8.7.x,
use package 1.0.11 with native bbox v0.3.3.
The native archive is downloaded and extracted outside the JSH heap. Installation
requires `curl` and `tar` on Linux/macOS, or PowerShell on Windows.

## Overview

neo-pkg-blackbox helps you connect video sources, manage cameras, and review detection-based events inside Machbase Neo.

The package brings together common system settings, Blackbox server registration, camera configuration, and event monitoring so operators can manage the full workflow from one place. Instead of handling separate tools for setup and day-to-day checks, you can register servers, add cameras, tune detection-related options, and inspect event history directly in the browser.

## Who is it for?

- **Operators** - Register servers and cameras, check event history, and review whether the system is behaving as expected
- **Integrators** - Set up the video pipeline, adjust detection-related options, and organize a multi-camera environment for deployment

## Key Features

- **Centralized Setup** - Configure common paths, integration settings, and server connection information from the built-in settings pages
- **Server and Camera Management** - Register Blackbox servers, add cameras under each server, and update camera settings from the UI
- **Live Camera Configuration** - Manage RTSP connection details, detection options, FFmpeg-related settings, and preview-oriented camera information in one screen
- **Detection and Event Rules** - Tune detection behavior and define event rules that control how camera events are evaluated
- **Event Monitoring** - Search recorded events by time range, camera, and event type, then open details for closer inspection
- **Operations-Friendly Workflow** - Use one package for setup, camera administration, and event review instead of moving between separate tools
