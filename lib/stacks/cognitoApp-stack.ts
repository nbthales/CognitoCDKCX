import * as lambda from "@aws-cdk/aws-lambda";
import * as lambdaNodeJS from "@aws-cdk/aws-lambda-nodejs";
import * as cdk from "@aws-cdk/core";
import * as apigateway from "@aws-cdk/aws-apigateway";
import * as cwlogs from "@aws-cdk/aws-logs";
import * as cognito from "@aws-cdk/aws-cognito"

interface CognitoAppStackProps extends cdk.StackProps {
  branch: string
}

export class CognitoAppStack extends cdk.Stack {
  public readonly urlOutput: cdk.CfnOutput;

  constructor(scope: cdk.Construct, id: string, props: CognitoAppStackProps) {
    super(scope, id, props);

    const logGroup = new cwlogs.LogGroup(this, "CognitoApiLogs");
    const api = new apigateway.RestApi(this, "cognito-api", {
      restApiName: "Cognito Test Service",
      deployOptions: {
        accessLogDestination: new apigateway.LogGroupLogDestination(logGroup),
        accessLogFormat: apigateway.AccessLogFormat.jsonWithStandardFields({
          caller: true,
          httpMethod: true,
          ip: true,
          protocol: true,
          requestTime: true,
          resourcePath: true,
          responseLength: true,
          status: true,
          user: true,
        }),
      },
    });

    //Cognito lambda triggers
    const postConfirmationHandler = new lambdaNodeJS.NodejsFunction(this, "PostConfirmationFunction", {
      functionName: "PostConfirmationFunction",
      entry: "lambda/postConfirmationFunction.js",
      handler: "handler",
      bundling: {
        minify: false,
        sourceMap: false,
      },
      tracing: lambda.Tracing.ACTIVE,
      memorySize: 128,
      timeout: cdk.Duration.seconds(30),
    });
    const preAuthenticationHandler = new lambdaNodeJS.NodejsFunction(this, "PreAuthenticationFunction", {
      functionName: "PreAuthenticationFunction",
      entry: "lambda/preAuthenticationFunction.js",
      handler: "handler",
      bundling: {
        minify: false,
        sourceMap: false,
      },
      tracing: lambda.Tracing.ACTIVE,
      memorySize: 128,
      timeout: cdk.Duration.seconds(30),
    });

    //Cognito customer user pool
    const customerUserPool = new cognito.UserPool(this, "CustomerPool", {
      userPoolName: "CustomerPool",
      lambdaTriggers: {
        postConfirmation: postConfirmationHandler,
        preAuthentication: preAuthenticationHandler
      },
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      selfSignUpEnabled: true,
      autoVerify: {
        email: true,
        phone: false
      },
      userVerification: {
        emailSubject: "Verifique seu e-mail",
        emailBody: "Obrigado por se registrar. Seu código de verificação é {####}",
        emailStyle: cognito.VerificationEmailStyle.CODE
      },
      signInAliases: {
        username: false,
        email: true
      },
      standardAttributes: {
        fullname: {
          required: true,
          mutable: false
        }
      },
      passwordPolicy: {
        minLength: 8,
        requireLowercase: true,
        requireUppercase: true,
        requireDigits: true,
        requireSymbols: true,
        tempPasswordValidity: cdk.Duration.days(3)
      },
      accountRecovery: cognito.AccountRecovery.EMAIL_ONLY,
    })
    customerUserPool.addDomain("CustomerDomain", {
      cognitoDomain: {
        domainPrefix: props.branch.concat('-terra-customer-service')
      }
    })

    //Cognito admin user pool
    const adminUserPool = new cognito.UserPool(this, "AdminPool", {
      userPoolName: "AdminPool",
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      selfSignUpEnabled: true,
      autoVerify: {
        email: true,
        phone: false
      },
      userVerification: {
        emailSubject: "Verifique seu e-mail",
        emailBody: "Obrigado por se registrar. Seu código de verificação é {####}",
        emailStyle: cognito.VerificationEmailStyle.CODE
      },
      signInAliases: {
        username: false,
        email: true
      },
      standardAttributes: {
        fullname: {
          required: true,
          mutable: false
        }
      },
      passwordPolicy: {
        minLength: 8,
        requireLowercase: true,
        requireUppercase: true,
        requireDigits: true,
        requireSymbols: true,
        tempPasswordValidity: cdk.Duration.days(3)
      },
      accountRecovery: cognito.AccountRecovery.EMAIL_ONLY,
    })
    adminUserPool.addDomain("AdminDomain", {
      cognitoDomain: {
        domainPrefix: props.branch.concat('-terra-admin-service')
      }
    })

    const customerWebScope = new cognito.ResourceServerScope({
      scopeName: "web",
      scopeDescription: "Customer web operation"
    })
    const customerMobileScope = new cognito.ResourceServerScope({
      scopeName: "mobile",
      scopeDescription: "Customer mobile operation"
    })

    const adminWebScope = new cognito.ResourceServerScope({
      scopeName: "web",
      scopeDescription: "Admin web operation"
    })

    const customerResourceServer = customerUserPool.addResourceServer("CustomerResourceServer", {
      identifier: "customer",
      userPoolResourceServerName: "CustomerResourceServer",
      scopes: [customerWebScope, customerMobileScope]
    })

    const adminResourceServer = adminUserPool.addResourceServer("AdminResourceServer", {
      identifier: "admin",
      userPoolResourceServerName: "AdminResourceServer",
      scopes: [adminWebScope]
    })

    customerUserPool.addClient('customer-web-client', {
      userPoolClientName: 'customerWebClient',
      authFlows: {
        userPassword: true,
      },
      accessTokenValidity: cdk.Duration.minutes(60),
      refreshTokenValidity: cdk.Duration.days(7),
      oAuth: {
        scopes: [cognito.OAuthScope.resourceServer(customerResourceServer, customerWebScope),
        cognito.OAuthScope.COGNITO_ADMIN]
      }
    })

    customerUserPool.addClient('customer-mobile-client', {
      userPoolClientName: 'customerMobileClient',
      authFlows: {
        userPassword: true,
      },
      accessTokenValidity: cdk.Duration.minutes(60),
      refreshTokenValidity: cdk.Duration.days(7),
      oAuth: {
        scopes: [cognito.OAuthScope.resourceServer(customerResourceServer, customerMobileScope),
        cognito.OAuthScope.COGNITO_ADMIN]
      }
    })

    adminUserPool.addClient('admin-web-client', {
      userPoolClientName: 'adminWebClient',
      authFlows: {
        userPassword: true,
      },
      accessTokenValidity: cdk.Duration.minutes(60),
      refreshTokenValidity: cdk.Duration.days(7),
      oAuth: {
        scopes: [cognito.OAuthScope.resourceServer(adminResourceServer, adminWebScope),
        cognito.OAuthScope.COGNITO_ADMIN]
      }
    })

    const productsAuthorizer = new apigateway.CognitoUserPoolsAuthorizer(this, 'ProductsAuthorizer', {
      cognitoUserPools: [customerUserPool, adminUserPool],
      authorizerName: "ProductsAuthorizer"
    })

    const productsAdminAuthorizer = new apigateway.CognitoUserPoolsAuthorizer(this, 'ProductsAdminAuthorizer', {
      cognitoUserPools: [adminUserPool],
      authorizerName: "ProductsAdminAuthorizer"
    })

    const productsFetchHandler = new lambdaNodeJS.NodejsFunction(this, "ProductsFetchFunction", {
      functionName: "ProductsFetchFunction",
      entry: "lambda/productsFetchFunction.js",
      handler: "handler",
      bundling: {
        minify: false,
        sourceMap: false,
      },
      tracing: lambda.Tracing.ACTIVE,
      memorySize: 128,
      timeout: cdk.Duration.seconds(30),
    });
    const productsAdminHandler = new lambdaNodeJS.NodejsFunction(this, "ProductsAdminFunction", {
      functionName: "ProductsAdminFunction",
      entry: "lambda/productsAdminFunction.js",
      handler: "handler",
      bundling: {
        minify: false,
        sourceMap: false,
      },
      tracing: lambda.Tracing.ACTIVE,
      memorySize: 128,
      timeout: cdk.Duration.seconds(30),
    });

    const productsFetchFunctionIntegration = new apigateway.LambdaIntegration(productsFetchHandler);
    const productsAdminFunctionIntegration = new apigateway.LambdaIntegration(productsAdminHandler);

    const productsFetchWebMobileIntegrationOption = {
      authorizer: productsAuthorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO,
      authorizationScopes: ['customer/web', 'customer/mobile', 'admin/web']
    }
    const productsFetchWebIntegrationOption = {
      authorizer: productsAuthorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO,
      authorizationScopes: ['customer/web', 'admin/web']
    }
    const productsAdminWebIntegrationOption = {
      authorizer: productsAdminAuthorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO,
      authorizationScopes: ['admin/web']
    }
    const productsResource = api.root.addResource("products")

    //GET all products - web and mobile (customer, admin)
    productsResource.addMethod("GET", productsFetchFunctionIntegration, productsFetchWebMobileIntegrationOption)
    //POST product - web (admin)
    productsResource.addMethod("POST", productsAdminFunctionIntegration, productsAdminWebIntegrationOption)

    //GET product by ID - web (customer, admin)
    const productByIdResource = productsResource.addResource("{id}")
    productByIdResource.addMethod("GET", productsFetchFunctionIntegration, productsFetchWebIntegrationOption)
  }
}