# Configuration
The app config.json is stored in the same directory as your database in a platform-specific user directory:

Windows: %USERPROFILE%/AppData/Local/MeshCommunityPlanner/config.json

macOS: ~/Library/Application Support/MeshCommunityPlanner/config.json

Linux: ~/.local/share/mesh-community-planner/config.json

## Default config.json
~~~
{
  "bind_host": "127.0.0.1",
  "webui_port": 8321,
  "app_mode": true
}
~~~

## Config Entries Explained

"bind_host" is the IP address that the WebUI binds to. The default is 127.0.0.1, which allows only your local PC to connect. If you want to host this as a server, you can dedicate a specific IP address here, or use 0.0.0.0 to bind to any IP address assigned to your system. **Warning:** Binding to 0.0.0.0 will expose the WebUI to your network; ensure proper firewall rules and authentication are in place.

"webui_port" is the port that the WebUI binds to. The default is 8321, but you can set it to whatever is desirable here. If app_mode is true and that port is already bound to another service, the software will automatically choose another port (which you can find in the logs).

"app_mode" dictates whether or not a browser tab automatically pops up upon program runtime, along with whether the server automatically shuts down upon the closing of that browser tab. The default is true, but you can set it to false if you wish to self-host this and have it accessible 24/7.