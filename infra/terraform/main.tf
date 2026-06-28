terraform {
  required_version = ">= 1.8.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

provider "aws" {
  region = var.aws_region
}

module "network" {
  source = "./modules/network"
  name   = var.name
}

module "data" {
  source     = "./modules/data"
  name       = var.name
  subnet_ids = module.network.private_subnet_ids
  vpc_id     = module.network.vpc_id
}
