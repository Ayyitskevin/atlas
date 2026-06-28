variable "aws_region" {
  type        = string
  description = "AWS region for Atlas staging."
  default     = "us-east-1"
}

variable "name" {
  type        = string
  description = "Deployment name prefix."
  default     = "atlas-staging"
}
