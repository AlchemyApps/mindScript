variable "project_name" {
  description = "Name of the project"
  type        = string
  default     = "mindscript"
}

variable "environment" {
  description = "Environment name (dev, staging, production)"
  type        = string
}

variable "aws_region" {
  description = "AWS region for resources"
  type        = string
  default     = "us-east-1"
}

variable "supabase_storage_url" {
  description = "Supabase Storage URL for origin"
  type        = string
}

variable "supabase_project_ref" {
  description = "Supabase project reference"
  type        = string
}

variable "custom_domain" {
  description = "Custom domain for CloudFront distribution"
  type        = string
}

variable "acm_certificate_arn" {
  description = "ACM certificate ARN for custom domain"
  type        = string
}

variable "price_class" {
  description = "CloudFront price class"
  type        = string
  default     = "PriceClass_100"
}

variable "geo_restrictions" {
  description = "List of country codes for geo-restriction"
  type        = list(string)
  default     = []
}

variable "waf_web_acl_id" {
  description = "Optional WAF Web ACL ID for DDoS protection"
  type        = string
  default     = ""
}

variable "tags" {
  description = "Tags to apply to resources"
  type        = map(string)
  default = {
    Project     = "MindScript"
    ManagedBy   = "Terraform"
    Service     = "CDN"
  }
}