---
title: Troubleshooting
weight: 60
---

# Troubleshooting

## A Server Is Registered but Does Not Connect

Check the following.

- Whether the actual `IP / Port` is correct, not just the Alias
- Whether the server process is running
- Whether there is a firewall or network restriction

If possible, run **Test Connection** from the registration screen first.

## The Camera List Is Empty

- Confirm that at least one Blackbox Server is actually registered.
- Check whether the `Camera Directory` path in Settings is correct.
- After adding a server or changing a path, use **Refresh** to load the list again.

## A Camera Is Registered but No Video Arrives

Check the following in order.

1. Whether the RTSP URL is correct
2. Whether **Ping** succeeds
3. Whether the FFmpeg path is correct
4. Whether the camera is in the `Enabled` state

Even if Ping succeeds, video can still fail if the RTSP path or credentials are wrong.

## Detection Results Do Not Appear

- Check whether `Detect Objects` is not empty.
- Confirm that Detection is enabled for that camera.
- Verify Detection itself before troubleshooting Event Rules.

## Machbase Integration Error

- Check whether the Machbase `Host / Port / Timeout Seconds` in Settings is correct.
- If `Use Token` is enabled, confirm that the token configuration matches the actual environment.
- Confirm that Machbase Neo itself is running normally.

## No Events Are Visible

- Check whether the time range is too narrow.
- If `Type` is not `ALL`, remember that only matching event types are shown.
- Confirm that the correct camera is selected.

## Log Files Are Not Created

- Check whether the `Log Directory` path in Settings actually exists.
- Check whether the directory is writable.
- Confirm that `Output Destination` is configured to include file output.

## MediaMTX Streaming Error

- Check whether the MediaMTX `Host / Port` in Settings is correct.
- Check the `MediaMTX Binary` path and execution permission.
- Confirm that the MediaMTX process is actually running.

## There Are Too Many Logs

Adjust the following items in **Log Configuration** under Settings.

- `Log Level`
- `Max File Size`
- `Max Backups`
- `Max Age`

During normal operation, `info` or `warn` is usually sufficient.

## Retention Does Not Seem to Run

- Check whether `Enable Retention` is turned on in the **Retention** tab under Settings.
- Check the `Start At` and `Interval Hours` settings. The schedule value is stored internally in UTC.
- Check whether the next run time (`Next Run`) in the Retention tab matches your expectation.
- If you need to verify cleanup immediately, run **Manual Run** and review the result.
- If files are not deleted, check delete permissions for `Data Directory` and each camera storage path.

## Recommended Operational Practice

- Start with one server and one camera.
- Add Detection and Event Rules gradually.
- After changing paths or binary settings, verify the actual behavior again.

## Navigation

- [Previous: Event Monitoring](./event-monitoring.en.md)
- [Back to Index](./index.en.md)
