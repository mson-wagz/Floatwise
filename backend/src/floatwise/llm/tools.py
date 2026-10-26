from typing import Any, Dict, Callable

class Tool:
    def __init__(self, name: str, description: str, function: Callable[..., Any]):
        self.name = name
        self.description = description
        self.function = function

    def execute(self, *args, **kwargs) -> Any:
        return self.function(*args, **kwargs)

class ToolRegistry:
    def __init__(self):
        self.tools: Dict[str, Tool] = {}

    def register_tool(self, tool: Tool):
        self.tools[tool.name] = tool

    def get_tool(self, name: str) -> Tool:
        return self.tools.get(name)

    def list_tools(self) -> Dict[str, str]:
        return {name: tool.description for name, tool in self.tools.items()}

# Example tool functions
def example_tool_function(param1: str, param2: int) -> str:
    return f"Processed {param1} with value {param2}"

# Initialize the tool registry and register an example tool
tool_registry = ToolRegistry()
example_tool = Tool(name="ExampleTool", description="An example tool for demonstration.", function=example_tool_function)
tool_registry.register_tool(example_tool)