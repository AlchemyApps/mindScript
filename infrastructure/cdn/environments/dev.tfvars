environment           = "dev"
aws_region           = "us-east-1"
supabase_storage_url = "https://your-project-ref.supabase.co/storage/v1"
supabase_project_ref = "your-project-ref"
custom_domain        = "cdn-dev.mindscript.app"
acm_certificate_arn  = "arn:aws:acm:us-east-1:123456789012:certificate/your-cert-id"
price_class          = "PriceClass_100" # Use only North America and Europe for dev

tags = {
  Environment = "dev"
  Project     = "MindScript"
  ManagedBy   = "Terraform"
  Service     = "CDN"
  CostCenter  = "Development"
}