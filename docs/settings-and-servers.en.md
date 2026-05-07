---
title: Settings and Server Registration
weight: 20
---

# Settings and Server Registration

For the Blackbox package, it is best to review the common **Settings** first and then register the actual **Blackbox Server** instances to connect to.

## Settings Screen

The Settings screen at the top consists of four tabs.

- `General`
- `FFmpeg Default`
- `Log Configuration`
- `Retention`

Click the **Save** button in the upper-right corner to save your changes.

![General settings screen](./images/blackbox-settings-general.png)

## General Tab

The General tab defines connection information and paths shared by the whole package.

Main items:

- `Address`
  - The address and port where the Blackbox server listens.
- `Camera Directory`
  - The path where camera configuration files are stored.
- `MVS Directory`
  - The path for AI-related models or supporting files.
- `Data Directory`
  - The path where video or related data is stored.
- `Machbase`
  - Sets the Host, Port, and Timeout Seconds used to communicate with Machbase Neo.
  - If needed, enable `Use Token` to use token-based authentication.
- `MediaMTX`
  - Sets the Host, Port, and Binary path for MediaMTX.
- `FFmpeg / FFprobe Binary`
  - Sets the executable paths for FFmpeg and FFprobe.

For most users, the default values are fine after installation. In most cases, you only need to review the address and paths for your environment.

## FFmpeg Default Tab

This tab manages the default arguments for FFmpeg or ffprobe.

- You can add default probe options.
- You can edit or delete existing entries.
- Use this tab when you want to standardize video analysis or metadata query rules.

Unless you have a specific operational need, it is safer to keep the defaults and adjust them only when troubleshooting is necessary.

## Log Configuration Tab

This tab defines the package-wide log policy.

Main items:

- `Log Directory`
- `Log Level`
- `Log Format`
- `Output Destination`
- `Filename Pattern`
- `Max File Size`
- `Max Backups`
- `Max Age`
- `Compress Old Logs`

Recommendations:

- Normal operation: `info` or `warn`
- Troubleshooting: temporarily use `debug`

Since `debug` can increase log volume quickly, avoid keeping it enabled for a long period.

## Retention Tab

The Retention tab defines the automatic cleanup policy for old Blackbox data.

Blackbox stores video information as both Machbase table rows and video files. During long-term operation, storage usage can grow quickly, so it is recommended to configure the retention period and cleanup schedule for production environments.

Main items:

- `Enable Retention`
  - Enables or disables automatic cleanup.
- `Keep Hours`
  - Data older than this number of hours from the current time becomes a cleanup target.
  - For example, `72` means keeping about 3 days of data.
- `Start At`
  - The first scheduled time when automatic cleanup starts.
  - Enter this value in the user's local timezone.
  - The value is converted to UTC internally when it is saved.
- `Interval Hours`
  - The repeat interval after the first scheduled run.
  - For example, `24` means running once per day.

When settings are saved, the Retention scheduler reloads the new settings and recalculates the next run time. Saving the settings does not immediately run cleanup.

## Manual Run

**Manual Run** in the Retention tab runs the cleanup once immediately, without waiting for the next scheduled time.

Manual Run does not change the automatic schedule. The next automatic cleanup still follows the configured `Start At` and `Interval Hours`.

After Manual Run finishes, the screen shows the run result. `Started At`, the cleanup start time, is shown in the upper-right corner of the result area.

- `ROWS`
  - The number of DB rows identified as cleanup candidates.
- `FILES`
  - The number of deleted video files.
- `MISSING`
  - The number of DB rows whose referenced file was already missing.
- `SKIPPED`
  - The number of files skipped because of safety checks.
- `METADATA`
  - The number of metadata entries removed because no data remained.

Manual Run can delete real data and files, so in production it is safer to check `Keep Hours` before running it.

## Checks After Saving Settings

When you click the **Save** button in the upper-right corner of each Settings tab, the changes are saved.

- After changing paths or binary settings, verify actual camera behavior again.
- If you change installation paths or executable paths, a restart or re-apply step may be required.
- In an operational environment, it is safer to verify server connectivity, camera status, and log generation right after saving.

## Registering a Blackbox Server

In the **BLACKBOX SERVER** section of the left sidebar, click the `+` button to register a new server.

Input fields:

- `Alias`
  - The server name shown in the UI
- `IP Address`
  - The actual Blackbox Server address
- `Port`
  - The port used by that server

Registration flow:

1. Click the `+` button.
2. Enter Alias, IP, and Port.
3. If possible, run **Test Connection** first.
4. Click **Save**.

![Blackbox server registration screen](./images/blackbox-server-form.png)

## Check the Auto-Registered Localhost Server After Installation

During the first installation, a localhost server may be registered automatically.

- The default IP for this server is `127.0.0.1`.
- If you keep this value, the server can be accessed only from the same computer.
- If other computers need to use this Blackbox Server, change it to the actual IP address reachable from outside.

Recommended flow:

1. Open the auto-registered localhost server.
2. Check whether `IP Address` is set to `127.0.0.1`.
3. Change it to the server IP that other computers can reach.
4. Run **Test Connection** again.
5. Click **Save**.

![Editing the localhost server IP](./images/blackbox-server-localhost-edit.png)

## Managing Registered Servers

From the sidebar, you can perform the following actions for each server.

- `Refresh`
  - Reloads the server list and camera status
- `Settings`
  - Edits server information
- `Delete`
  - Deletes the server

If the connection fails, an error state may appear in the sidebar. Recheck the IP, Port, and the server process itself.

Deleting a server can also make the cameras under that server inaccessible, so use it carefully in an operational environment.

## Notes for Users

- The shared paths in Settings and the IP/Port of each server serve different purposes.
- If the MediaMTX, FFmpeg, or Machbase address is wrong, the camera may be registered but actual operation can still fail.
- It is best to start with one server and one camera, confirm normal behavior, and then expand.

## Navigation

- [Back to Index](./index.en.md)
- [Next: Camera Management](./camera-management.en.md)
