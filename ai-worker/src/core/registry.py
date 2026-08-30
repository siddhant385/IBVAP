from typing import Dict, Type
from src.plugins.base import BasePlugin

class PluginRegistry:
    def __init__(self):
        self._plugins: Dict[str, BasePlugin] = {}

    def register(self, plugin: BasePlugin):
        self._plugins[plugin.event_type] = plugin
        print(f"Registered plugin: {plugin.event_type}")

    def get_plugin(self, event_type: str) -> BasePlugin:
        return self._plugins.get(event_type)

    @property
    def registered_events(self):
        return list(self._plugins.keys())

registry = PluginRegistry()
