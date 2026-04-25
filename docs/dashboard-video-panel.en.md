---
title: Using Dashboard Video Panels
weight: 40
---

# Using Dashboard Video Panels

After `neo-pkg-blackbox` is installed, you can select `Type = Video` when creating a panel in a Neo Web dashboard.

This lets you view registered camera streams inside a dashboard, show the current video time on linked chart panels, and open a child dashboard from the video panel.

## Before You Start

- The Blackbox package must be installed.
- A Blackbox Server and at least one camera should already be registered.
- It is better to confirm that the target camera already connects and plays normally before adding dashboard options.

## Creating a Video Panel

1. Open the target dashboard in Neo Web.
2. Open the add-panel screen.
3. Select `Video` in `Type`.
4. Configure the `Source` and `Events` tabs on the left and the option panel on the right.
5. Save the panel with **Apply** or **Save**.

![Video panel creation screen](./images/blackbox-dashboard-video-create.png)

## Source Tab

The `Source` tab defines the basic video playback behavior.

- `Camera`
  - Select the camera used by this Video panel.
- `Live Mode on Start`
  - Starts this panel in Live mode when the dashboard is opened.
- `Enable Synchronization`
  - Makes time synchronization features available for Video panels.

## Events Tab

In the `Events` tab, you can use the same event-related settings as in the camera management screen.

- `Camera`
  - Select the camera used for event settings.
- `Detection`
  - Choose which objects to detect.
- `Event Rule`
  - Register conditions that generate events from detection results.

For example, you can use expressions such as `person > 0`, `car >= 2`, and `person > 0 AND car > 0`.  
It is best to use only the objects already registered in Detection for the selected camera.

## Right Option Panel

The right option panel defines dashboard-level options that work with the Video panel.

### Dependent option

In `Dependent option`, you select chart panels that should receive synchronized time markers.

- Only chart panels in the current dashboard can be selected.
- Supported targets are `Line`, `Bar`, and `Scatter`.
- The practical rule is that the chart must support a time-based X axis.
- When a chart panel is selected, a vertical dashed line is drawn on that chart at the current video time while reviewing recorded video.
- This vertical dashed line is not shown in Live mode.
- `Time sync color` controls the color of that vertical line.

### Child dashboard

In `Child dashboard`, you specify a linked dashboard.

- You can enter the dashboard path directly in `Path`.
- You can choose a dashboard with the select button.
- You can open the linked dashboard immediately with the open button.

Once a child dashboard is registered, you can open it in a new window from the `Child board` item in the Video panel header menu.

![Right option panel screen](./images/blackbox-dashboard-video-options.png)

## Panel Header Menu

The Video panel header menu provides the following functions.

- `Synchronization`
  - Turns panel synchronization on or off.
  - Video panels with synchronization enabled in the same dashboard can align their time range, playback position, and play/pause state.
- `Child board`
  - Opens the linked child dashboard in a new window.
- `Fullscreen`
  - Opens the Video panel in fullscreen mode.

Synchronization is mainly useful when reviewing recorded video rather than Live playback.

![Panel header menu screen](./images/blackbox-dashboard-video-menu.png)

## Bottom Controls and Timeline

The controls under the Video panel are used for playback and navigation.

- `Live`
  - Starts or stops real-time video viewing.
- `Time Range`
  - Sets the time range to review.
- Playback timeline
  - Shows the current position inside the selected time range and lets you move to another point in time.

Segments with no video data in the selected time range are shown in red on the playback timeline.

`Time Range` cannot be used while the panel is in Live mode.

The image below shows an example where the current video time is drawn as a vertical dashed line on the selected chart during recorded playback.

![Chart synchronization marker screen](./images/blackbox-dashboard-video-sync.png)

## Event Notifications and Review

If events exist in the currently viewed time range, the event notification icon at the top of the panel shows the count.

- The count may be shortened to `99+` when many events exist.
- Click the icon to open the event list.
- Selecting an event in the list moves the panel to that time so you can review the video.

![Event icon and count screen](./images/blackbox-dashboard-video-events.png)

![Event list screen](./images/blackbox-dashboard-video-events2.png)

## Operational Tips

- First confirm that one camera plays normally, then add chart synchronization or a child dashboard.
- Using synchronization together with chart time markers makes it easier to compare video time with chart data.
- If there are many events, narrow the time range first before reviewing the event list in the panel.

## Navigation

- [Previous: Camera Management](./camera-management.en.md)
- [Back to Index](./index.en.md)
- [Next: Event Monitoring](./event-monitoring.en.md)
