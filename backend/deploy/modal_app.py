
import os
import modal

# Define the Modal app and container image
image = (
    modal.Image.debian_slim(python_version="3.12")
    .pip_install_from_pyproject("pyproject.toml")
    .env({"PYTHONPATH": "/root/src"})
    .add_local_dir("src", remote_path="/root/src", copy=True)
)

app = modal.App("floatwise", image=image)

# Load environment variables from the Modal dashboard secret
secrets = modal.Secret.from_name("floatwise-secret")


@app.function(
    secrets=[secrets],
    min_containers=1,
    max_containers=1,
    scaledown_window=600,
    timeout=300,
)
@modal.concurrent(max_inputs=20)
@modal.asgi_app()
def web():
    import importlib

    os.environ.pop("FLOATWISE_OFFLINE", None)

    module, var = os.getenv(
        "FLOATWISE_ASGI", "floatwise.api.app:app"
    ).split(":")

    return getattr(importlib.import_module(module), var)
