terraform {
  required_version = ">= 1.5"

  required_providers {
    azurerm = {
      source  = "hashicorp/azurerm"
      version = "~> 4.0"
    }
  }
}

provider "azurerm" {
  features {}
  subscription_id = var.subscription_id
}

variable "subscription_id" {
  description = "Azure subscription ID"
  type        = string
}

variable "resource_group_name" {
  description = "Name of the existing resource group"
  type        = string
  default     = "rg-releases"
}

variable "location" {
  description = "Azure region"
  type        = string
  default     = "centralus"
}

variable "container_image" {
  description = "Full container image reference"
  type        = string
  default     = "ghcr.io/cpistohl/releases:latest"
}

variable "ghcr_username" {
  description = "GitHub Container Registry username"
  type        = string
  default     = "cpistohl"
}

variable "ghcr_password" {
  description = "GHCR PAT with read:packages scope"
  type        = string
  sensitive   = true
}

variable "tmdb_api_key" {
  description = "TMDB API key"
  type        = string
  sensitive   = true
}

data "azurerm_client_config" "current" {}

data "azurerm_resource_group" "main" {
  name = var.resource_group_name
}

# Log analytics
resource "azurerm_log_analytics_workspace" "main" {
  name                = "log-releases"
  location            = data.azurerm_resource_group.main.location
  resource_group_name = data.azurerm_resource_group.main.name
  sku                 = "PerGB2018"
  retention_in_days   = 30
}

# key vault
resource "azurerm_key_vault" "main" {
  name                = "kv-releases-cpistohl"
  location            = data.azurerm_resource_group.main.location
  resource_group_name = data.azurerm_resource_group.main.name
  tenant_id           = data.azurerm_client_config.current.tenant_id
  sku_name            = "standard"

  access_policy {
    tenant_id = data.azurerm_client_config.current.tenant_id
    object_id = data.azurerm_client_config.current.object_id

    secret_permissions = ["Get", "List", "Set", "Delete", "Purge"]
  }
}

resource "azurerm_key_vault_secret" "tmdb_api_key" {
  name         = "tmdb-api-key"
  value        = var.tmdb_api_key
  key_vault_id = azurerm_key_vault.main.id
}

# Container app environment
resource "azurerm_container_app_environment" "main" {
  name                       = "cae-releases"
  location                   = data.azurerm_resource_group.main.location
  resource_group_name        = data.azurerm_resource_group.main.name
  log_analytics_workspace_id = azurerm_log_analytics_workspace.main.id
}

# Container App
# Secrets are passed from Terraform variables (sourced from Key Vault via tfvars).
# Key Vault stores the source of truth; Terraform reads and applies them here.
resource "azurerm_container_app" "releases" {
  name                         = "releases"
  container_app_environment_id = azurerm_container_app_environment.main.id
  resource_group_name          = data.azurerm_resource_group.main.name
  revision_mode                = "Single"

  secret {
    name  = "ghcr-password"
    value = var.ghcr_password
  }

  secret {
    name  = "tmdb-api-key"
    value = var.tmdb_api_key
  }

  registry {
    server               = "ghcr.io"
    username             = var.ghcr_username
    password_secret_name = "ghcr-password"
  }

  ingress {
    external_enabled = true
    target_port      = 3000

    traffic_weight {
      latest_revision = true
      percentage      = 100
    }
  }

  template {
    container {
      name   = "releases"
      image  = var.container_image
      cpu    = 0.25
      memory = "0.5Gi"

      env {
        name        = "TMDB_API_KEY"
        secret_name = "tmdb-api-key"
      }
    }

    min_replicas = 0
    max_replicas = 1
  }
}

# Outputs
output "app_url" {
  value = "https://${azurerm_container_app.releases.ingress[0].fqdn}"
}
