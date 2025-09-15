environment           = "production"
aws_region           = "us-east-1"
supabase_storage_url = "https://your-prod-ref.supabase.co/storage/v1"
supabase_project_ref = "your-prod-ref"
custom_domain        = "cdn.mindscript.app"
acm_certificate_arn  = "arn:aws:acm:us-east-1:123456789012:certificate/your-prod-cert-id"
price_class          = "PriceClass_All" # Use all edge locations for production
waf_web_acl_id       = "arn:aws:wafv2:us-east-1:123456789012:global/webacl/your-waf-id"

# Optional geo-restrictions (example: allow only specific countries)
# geo_restrictions = ["US", "CA", "GB", "DE", "FR", "JP", "AU"]

tags = {
  Environment = "production"
  Project     = "MindScript"
  ManagedBy   = "Terraform"
  Service     = "CDN"
  CostCenter  = "Production"
  Compliance  = "GDPR"
}