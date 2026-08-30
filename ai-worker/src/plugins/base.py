from abc import ABC, abstractmethod
from typing import Dict, Any

class BasePlugin(ABC):
    @property
    @abstractmethod
    def event_type(self) -> str:
        """Returns the identifier string for event matching (e.g., 'face_recognition')"""
        pass

    @abstractmethod
    async def execute(self, payload: Dict[str, Any]) -> Dict[str, Any]:
        """Executes the plugin workload asynchronously."""
        pass
