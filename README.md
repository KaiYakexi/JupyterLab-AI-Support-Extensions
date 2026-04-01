# AI Prompt Extensions

A collection of JupyterLab 4.x extensions providing different types of AI/LLM support to students in Jupyter notebooks, built for an academic study. These extensions require a JupyterHub service to communicate with. The extension manager can be used to set the base URL of the JupyterHub by changing the value of the `setJupyterHubBaseUrl` variable.

This project is designed to work with the [JupyterHub LLM Extension](https://github.com/sixonenines/Jupyterhub_LLM_Extension) backend service.

## Deploying to Azure Container Registry with GitHub Actions

This repository includes a GitHub Actions workflow that builds the Docker image and pushes it to Azure Container Registry (ACR).

### Setup

1. **Fork this repository** to your own GitHub account.

2. In the Azure Portal, go to **Container Registries** > your registry > **Settings** > **Access keys** and enable **Admin user**.

3. In your forked repository, go to **Settings** > **Secrets and variables** > **Actions** and add the following secrets:

   | Secret | Value |
   |---|---|
   | `AZURE_REGISTRY_LOGIN_SERVER` | Your ACR login server (e.g., `myregistry.azurecr.io`) |
   | `AZURE_REGISTRY_USERNAME` | Your ACR admin username |
   | `AZURE_REGISTRY_PASSWORD` | Your ACR admin password |
   | `AZURE_IMAGE_NAME` | Full image name (e.g., `myregistry.azurecr.io/jupyterlab-students`) |

### Running the workflow

1. Go to the **Actions** tab in your GitHub repository.
2. Select **Build and Push to ACR** from the sidebar.
3. Click **Run workflow**, choose a branch, and confirm.

The workflow will build the Docker image and push it to your ACR tagged with both the commit SHA and `latest`.

## Local Development / Single-Server

If you are using this with the [JupyterHub LLM Extension](https://github.com/sixonenines/Jupyterhub_LLM_Extension) for local development or a single-server setup, build the Docker image directly from the root of this repository:

```bash
docker build -t jupyterlab-students:latest --label "courseName=jupyterlab-students" . --no-cache
```
