unit "networking" {
  source = "catalog://networking:v1.2.0"

  inputs = {
    environment = "production"
    vpc_cidr    = "10.0.0.0/16"
  }
}

unit "database" {
  source = "catalog://database:v2.1.0"

  dependencies = ["networking"]

  inputs = {
    vpc_id         = unit.networking.outputs.vpc_id
    subnet_ids     = unit.networking.outputs.private_subnet_ids
    instance_class = "db.r5.large"
  }
}

unit "application" {
  source = "../modules/app"

  dependencies = ["networking", "database"]

  inputs = {
    vpc_id            = unit.networking.outputs.vpc_id
    subnet_ids        = unit.networking.outputs.private_subnet_ids
    database_endpoint = unit.database.outputs.endpoint

    app_name    = "my-application"
    app_version = "v1.0.0"
  }
}
