from typing import Any, Dict, List
import asyncio

class Agent:
    def __init__(self, tools: List[Any]):
        self.tools = tools

    async def call_tool(self, tool_name: str, input_data: Dict[str, Any]) -> Any:
        tool = next((tool for tool in self.tools if tool.name == tool_name), None)
        if tool is None:
            raise ValueError(f"Tool {tool_name} not found.")
        
        result = await tool.execute(input_data)
        return result

    async def run(self, task: Dict[str, Any]) -> Dict[str, Any]:
        tool_name = task.get("tool")
        input_data = task.get("input", {})
        
        try:
            result = await self.call_tool(tool_name, input_data)
            return {"status": "success", "result": result}
        except Exception as e:
            return {"status": "error", "message": str(e)}

# Example usage:
# tools = [Tool1(), Tool2()]  # Replace with actual tool instances
# agent = Agent(tools)
# asyncio.run(agent.run({"tool": "Tool1", "input": {"key": "value"}}))