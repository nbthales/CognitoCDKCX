import * as lambda from "@aws-cdk/aws-lambda";
import * as lambdaNodeJS from "@aws-cdk/aws-lambda-nodejs";
import * as cdk from "@aws-cdk/core";
import * as apigateway from "@aws-cdk/aws-apigateway";
import * as cwlogs from "@aws-cdk/aws-logs";

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

    const productsFetchFunctionIntegration = new apigateway.LambdaIntegration(productsFetchHandler);

    const productsResource = api.root.addResource("products")

    productsResource.addMethod("GET", productsFetchFunctionIntegration)
  }
}