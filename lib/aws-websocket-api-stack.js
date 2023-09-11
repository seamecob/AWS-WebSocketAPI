"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AwsWebsocketApiStack = void 0;
const cdk = require("aws-cdk-lib");
const aws_lambda_1 = require("aws-cdk-lib/aws-lambda");
const aws_apigatewayv2_1 = require("aws-cdk-lib/aws-apigatewayv2");
const aws_cdk_lib_1 = require("aws-cdk-lib");
const aws_iam_1 = require("aws-cdk-lib/aws-iam");
const aws_dynamodb_1 = require("aws-cdk-lib/aws-dynamodb");
const config = require("../config.json");
// Now you can access properties using the config object
const region = config.region;
const account_id = config.account_id;
const tableName = "ChatForUser";
const createLambdaFunction = (Construct, name, codePath) => {
    return new aws_lambda_1.Function(Construct, name, {
        code: new aws_lambda_1.AssetCode(codePath),
        handler: "app.handler",
        runtime: aws_lambda_1.Runtime.NODEJS_14_X,
        timeout: aws_cdk_lib_1.Duration.seconds(300),
        memorySize: 256,
        environment: {
            TABLE_NAME: tableName,
        },
    });
};
function createMessageFunction(scope, api, table, tableName, region, account_id) {
    return new aws_lambda_1.Function(scope, 'message-lambda', {
        code: new aws_lambda_1.AssetCode('./sendmessage'),
        handler: 'app.handler',
        runtime: aws_lambda_1.Runtime.NODEJS_14_X,
        timeout: aws_cdk_lib_1.Duration.seconds(300),
        memorySize: 256,
        initialPolicy: [
            new aws_iam_1.PolicyStatement({
                actions: ['execute-api:ManageConnections'],
                resources: [`arn:aws:execute-api:${region}:${account_id}:${api.ref}/*`],
                effect: aws_iam_1.Effect.ALLOW,
            })
        ],
        environment: {
            "TABLE_NAME": tableName,
        }
    });
}
class AwsWebsocketApiStack extends cdk.Stack {
    constructor(scope, id, props) {
        super(scope, id, props);
        const name = id + "-api";
        const api = new aws_apigatewayv2_1.CfnApi(this, name, {
            name: "ChatAppApi",
            protocolType: "WEBSOCKET",
            routeSelectionExpression: "$request.body.action",
        });
        const table = new aws_dynamodb_1.Table(this, `${name}-table`, {
            tableName: tableName,
            partitionKey: {
                name: "connectionId",
                type: aws_dynamodb_1.AttributeType.STRING,
            },
            readCapacity: 5,
            writeCapacity: 5,
            removalPolicy: aws_cdk_lib_1.RemovalPolicy.DESTROY
        });
        const connectFunc = createLambdaFunction(this, "connect-lambda", "./onconnect");
        const disconnectFunc = createLambdaFunction(this, "disconnect-lambda", "./ondisconnect");
        const messageFunc = createMessageFunction(this, api, table, tableName, region, account_id);
        /*const messageFunc = createLambdaFunction("message-lambda", "./sendmessage");
        messageFunc.addToRolePolicy(
          new PolicyStatement({
            actions: ["execute-api:ManageConnections"],
            resources: [
              "arn:aws:execute-api:" +
                config["region"] +
                ":" +
                config["account_id"] +
                ":" +
                api.ref +
                "/*",
            ],
            effect: Effect.ALLOW,
          })
        );*/
        table.grantReadWriteData(connectFunc);
        table.grantReadWriteData(disconnectFunc);
        table.grantReadWriteData(messageFunc);
        /*const messageFunc = new Function(this, 'message-lambda', {
            code: new AssetCode('./sendmessage'),
            handler: 'app.handler',
            runtime: Runtime.NODEJS_14_X,
            timeout: Duration.seconds(300),
            memorySize: 256,
            initialPolicy: [
                new PolicyStatement({
                    actions: [
                        'execute-api:ManageConnections'
                    ],
                    resources: [
                        "arn:aws:execute-api:" +  region + ":" +  account_id + ":" + api.ref + "/*"
                    ],
                    effect: Effect.ALLOW,
                })
            ],
            environment: {
                "TABLE_NAME": tableName,
            }
        });
        
        table.grantReadWriteData(messageFunc);
        */
        /*  const connectFunc = new Function(this, 'connect-lambda', {
              code: new AssetCode('./onconnect'),
              handler: 'app.handler',
              runtime: Runtime.NODEJS_18_X,
              timeout: Duration.seconds(300),
              memorySize: 256,
              environment: {
                  "TABLE_NAME": tableName,
              }
          });
  
          table.grantReadWriteData(connectFunc)
  
          const disconnectFunc = new Function(this, 'disconnect-lambda', {
              code: new AssetCode('./ondisconnect'),
              handler: 'app.handler',
              runtime: Runtime.NODEJS_18_X,
              timeout: Duration.seconds(300),
              memorySize: 256,
              environment: {
                  "TABLE_NAME": tableName,
              }
          });
  
          table.grantReadWriteData(disconnectFunc)
  
          const messageFunc = new Function(this, 'message-lambda', {
              code: new AssetCode('./sendmessage'),
              handler: 'app.handler',
              runtime: Runtime.NODEJS_18_X,
              timeout: Duration.seconds(300),
              memorySize: 256,
              initialPolicy: [
                  new PolicyStatement({
                      actions: [
                          'execute-api:ManageConnections'
                      ],
                      resources: [
                          "arn:aws:execute-api:" +  region + ":" +  account_id + ":" + api.ref + "/*"
                      ],
                      effect: Effect.ALLOW,
                  })
              ],
              environment: {
                  "TABLE_NAME": tableName,
              }
          });
  
          table.grantReadWriteData(messageFunc)*/
        // access role for the socket api to access the socket lambda
        const policy = new aws_iam_1.PolicyStatement({
            effect: aws_iam_1.Effect.ALLOW,
            resources: [
                connectFunc.functionArn,
                disconnectFunc.functionArn,
                messageFunc.functionArn
            ],
            actions: ["lambda:InvokeFunction"]
        });
        const role = new aws_iam_1.Role(this, `${name}-iam-role`, {
            assumedBy: new aws_iam_1.ServicePrincipal("apigateway.amazonaws.com")
        });
        role.addToPolicy(policy);
        function createLambdaIntegration(scope, // Change 'any' to the appropriate type for your CDK app
        api, // Change 'any' to the appropriate type for your CDK app
        functionName, functionArn, roleArn) {
            return new aws_apigatewayv2_1.CfnIntegration(scope, `${functionName}-lambda-integration`, {
                apiId: api.ref,
                integrationType: "AWS_PROXY",
                integrationUri: `arn:aws:apigateway:${region}:lambda:path/2015-03-31/functions/${functionArn}/invocations`,
                credentialsArn: roleArn,
            });
        }
        const connectIntegration = createLambdaIntegration(this, api, "connect", connectFunc.functionArn, role.roleArn);
        const disconnectIntegration = createLambdaIntegration(this, api, "disconnect", disconnectFunc.functionArn, role.roleArn);
        const messageIntegration = createLambdaIntegration(this, api, "message", messageFunc.functionArn, role.roleArn);
        // lambda integration
        // const connectIntegration = new CfnIntegration(this, "connect-lambda-integration", {
        //     apiId: api.ref,
        //     integrationType: "AWS_PROXY",
        //     integrationUri: "arn:aws:apigateway:" + region + ":lambda:path/2015-03-31/functions/" + connectFunc.functionArn + "/invocations",
        //     credentialsArn: role.roleArn,
        // })
        // const disconnectIntegration = new CfnIntegration(this, "disconnect-lambda-integration", {
        //     apiId: api.ref,
        //     integrationType: "AWS_PROXY",
        //     integrationUri: "arn:aws:apigateway:" + region + ":lambda:path/2015-03-31/functions/" + disconnectFunc.functionArn + "/invocations",
        //     credentialsArn: role.roleArn
        // })
        // const messageIntegration = new CfnIntegration(this, "message-lambda-integration", {
        //     apiId: api.ref,
        //     integrationType: "AWS_PROXY",
        //     integrationUri: "arn:aws:apigateway:" + region + ":lambda:path/2015-03-31/functions/" + messageFunc.functionArn + "/invocations",
        //     credentialsArn: role.roleArn
        // })
        // const connectRoute = new CfnRoute(this, "connect-route", {
        //     apiId: api.ref,
        //     routeKey: "$connect",
        //     authorizationType: "NONE",
        //     target: "integrations/" + connectIntegration.ref,
        // });
        // const disconnectRoute = new CfnRoute(this, "disconnect-route", {
        //     apiId: api.ref,
        //     routeKey: "$disconnect",
        //     authorizationType: "NONE",
        //     target: "integrations/" + disconnectIntegration.ref,
        // });
        // const messageRoute = new CfnRoute(this, "message-route", {
        //     apiId: api.ref,
        //     routeKey: "sendmessage",
        //     authorizationType: "NONE",
        //     target: "integrations/" + messageIntegration.ref,
        // });
        function createRoute(scope, // Change 'any' to the appropriate type for your CDK app
        api, // Change 'any' to the appropriate type for your CDK app
        routeKey, integration) {
            return new aws_apigatewayv2_1.CfnRoute(scope, `${routeKey}-route`, {
                apiId: api.ref,
                routeKey: routeKey,
                authorizationType: "NONE",
                target: `integrations/${integration.ref}`,
            });
        }
        const connectRoute = createRoute(this, api, "$connect", connectIntegration);
        const disconnectRoute = createRoute(this, api, "$disconnect", disconnectIntegration);
        const messageRoute = createRoute(this, api, "sendmessage", messageIntegration);
        const deployment = new aws_apigatewayv2_1.CfnDeployment(this, `${name}-deployment`, {
            apiId: api.ref
        });
        new aws_apigatewayv2_1.CfnStage(this, `${name}-stage`, {
            apiId: api.ref,
            autoDeploy: true,
            deploymentId: deployment.ref,
            stageName: "dev"
        });
        deployment.node.addDependency(connectRoute);
        deployment.node.addDependency(disconnectRoute);
        deployment.node.addDependency(messageRoute);
    }
}
exports.AwsWebsocketApiStack = AwsWebsocketApiStack;
const app = new aws_cdk_lib_1.App();
new AwsWebsocketApiStack(app, `chat-app`);
app.synth();
//wscat -c wss://{56ssm4ilqj}.execute-api.{us-east-1}.amazonaws.com/{env}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYXdzLXdlYnNvY2tldC1hcGktc3RhY2suanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyJhd3Mtd2Vic29ja2V0LWFwaS1zdGFjay50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7QUFBQSxtQ0FBa0M7QUFFbEMsdURBQXFFO0FBQ3JFLG1FQUF3RztBQUN4Ryw2Q0FBa0Y7QUFDbEYsaURBQXFGO0FBQ3JGLDJEQUErRDtBQUcvRCx5Q0FBd0M7QUFFeEMsd0RBQXdEO0FBQ3hELE1BQU0sTUFBTSxHQUFHLE1BQU0sQ0FBQyxNQUFNLENBQUE7QUFDNUIsTUFBTSxVQUFVLEdBQUcsTUFBTSxDQUFDLFVBQVUsQ0FBQTtBQUNwQyxNQUFNLFNBQVMsR0FBRyxhQUFhLENBQUM7QUFDaEMsTUFBTSxvQkFBb0IsR0FBRyxDQUFDLFNBQW9CLEVBQUMsSUFBWSxFQUFFLFFBQWdCLEVBQUUsRUFBRTtJQUNqRixPQUFPLElBQUkscUJBQVEsQ0FBQyxTQUFTLEVBQUUsSUFBSSxFQUFFO1FBQ2pDLElBQUksRUFBRSxJQUFJLHNCQUFTLENBQUMsUUFBUSxDQUFDO1FBQzdCLE9BQU8sRUFBRSxhQUFhO1FBQ3RCLE9BQU8sRUFBRSxvQkFBTyxDQUFDLFdBQVc7UUFDNUIsT0FBTyxFQUFFLHNCQUFRLENBQUMsT0FBTyxDQUFDLEdBQUcsQ0FBQztRQUM5QixVQUFVLEVBQUUsR0FBRztRQUNmLFdBQVcsRUFBRTtZQUNiLFVBQVUsRUFBRSxTQUFTO1NBQ3BCO0tBQ0osQ0FBQyxDQUFDO0FBQ0gsQ0FBQyxDQUFDO0FBRUYsU0FBUyxxQkFBcUIsQ0FDMUIsS0FBZ0IsRUFDaEIsR0FBVyxFQUNYLEtBQVksRUFDWixTQUFpQixFQUNqQixNQUFjLEVBQ2QsVUFBa0I7SUFFbEIsT0FBTyxJQUFJLHFCQUFRLENBQUMsS0FBSyxFQUFFLGdCQUFnQixFQUFFO1FBQ3pDLElBQUksRUFBRSxJQUFJLHNCQUFTLENBQUMsZUFBZSxDQUFDO1FBQ3BDLE9BQU8sRUFBRSxhQUFhO1FBQ3RCLE9BQU8s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QUFFLElBQUk7WUFDaEIsWUFBWSxFQUFFLFVBQVUsQ0FBQyxHQUFHO1lBQzVCLFNBQVMsRUFBRSxLQUFLO1NBQ25CLENBQUMsQ0FBQztRQUVILFVBQVUsQ0FBQyxJQUFJLENBQUMsYUFBYSxDQUFDLFlBQVksQ0FBQyxDQUFBO1FBQzNDLFVBQVUsQ0FBQyxJQUFJLENBQUMsYUFBYSxDQUFDLGVBQWUsQ0FBQyxDQUFBO1FBQzlDLFVBQVUsQ0FBQyxJQUFJLENBQUMsYUFBYSxDQUFDLFlBQVksQ0FBQyxDQUFBO0lBQy9DLENBQUM7Q0FDSjtBQXhPRCxvREF3T0M7QUFDRCxNQUFNLEdBQUcsR0FBRyxJQUFJLGlCQUFHLEVBQUUsQ0FBQztBQUN0QixJQUFJLG9CQUFvQixDQUFDLEdBQUcsRUFBRSxVQUFVLENBQUMsQ0FBQztBQUMxQyxHQUFHLENBQUMsS0FBSyxFQUFFLENBQUM7QUFFWix5RUFBeUUiLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgKiBhcyBjZGsgZnJvbSAnYXdzLWNkay1saWInXG5pbXBvcnQgeyBDb25zdHJ1Y3QgfSBmcm9tICdjb25zdHJ1Y3RzJ1xuaW1wb3J0IHsgQXNzZXRDb2RlLCBGdW5jdGlvbiwgUnVudGltZSB9IGZyb20gJ2F3cy1jZGstbGliL2F3cy1sYW1iZGEnXG5pbXBvcnQgeyBDZm5BcGksIENmbkRlcGxveW1lbnQsIENmbkludGVncmF0aW9uLCBDZm5Sb3V0ZSwgQ2ZuU3RhZ2UgfSBmcm9tICdhd3MtY2RrLWxpYi9hd3MtYXBpZ2F0ZXdheXYyJ1xuaW1wb3J0IHsgQXBwLCBEdXJhdGlvbiwgUmVtb3ZhbFBvbGljeSwgU3RhY2ssIHR5cGUgU3RhY2tQcm9wcyB9IGZyb20gJ2F3cy1jZGstbGliJ1xuaW1wb3J0IHsgRWZmZWN0LCBQb2xpY3lTdGF0ZW1lbnQsIFJvbGUsIFNlcnZpY2VQcmluY2lwYWwgfSBmcm9tICdhd3MtY2RrLWxpYi9hd3MtaWFtJ1xuaW1wb3J0IHsgQXR0cmlidXRlVHlwZSwgVGFibGUgfSBmcm9tICdhd3MtY2RrLWxpYi9hd3MtZHluYW1vZGInXG5cblxuaW1wb3J0ICogYXMgY29uZmlnIGZyb20gJy4uL2NvbmZpZy5qc29uJ1xuXG4vLyBOb3cgeW91IGNhbiBhY2Nlc3MgcHJvcGVydGllcyB1c2luZyB0aGUgY29uZmlnIG9iamVjdFxuY29uc3QgcmVnaW9uID0gY29uZmlnLnJlZ2lvblxuY29uc3QgYWNjb3VudF9pZCA9IGNvbmZpZy5hY2NvdW50X2lkIFxuY29uc3QgdGFibGVOYW1lID0gXCJDaGF0Rm9yVXNlclwiO1xuY29uc3QgY3JlYXRlTGFtYmRhRnVuY3Rpb24gPSAoQ29uc3RydWN0OiBDb25zdHJ1Y3QsbmFtZTogc3RyaW5nLCBjb2RlUGF0aDogc3RyaW5nKSA9PiB7XG4gICAgcmV0dXJuIG5ldyBGdW5jdGlvbihDb25zdHJ1Y3QsIG5hbWUsIHtcbiAgICAgICAgY29kZTogbmV3IEFzc2V0Q29kZShjb2RlUGF0aCksXG4gICAgICAgIGhhbmRsZXI6IFwiYXBwLmhhbmRsZXJcIixcbiAgICAgICAgcnVudGltZTogUnVudGltZS5OT0RFSlNfMTRfWCxcbiAgICAgICAgdGltZW91dDogRHVyYXRpb24uc2Vjb25kcygzMDApLFxuICAgICAgICBtZW1vcnlTaXplOiAyNTYsXG4gICAgICAgIGVudmlyb25tZW50OiB7XG4gICAgICAgIFRBQkxFX05BTUU6IHRhYmxlTmFtZSxcbiAgICAgICAgfSxcbiAgICB9KTtcbiAgICB9O1xuXG4gICAgZnVuY3Rpb24gY3JlYXRlTWVzc2FnZUZ1bmN0aW9uKFxuICAgICAgICBzY29wZTogQ29uc3RydWN0LFxuICAgICAgICBhcGk6IENmbkFwaSxcbiAgICAgICAgdGFibGU6IFRhYmxlLFxuICAgICAgICB0YWJsZU5hbWU6IHN0cmluZyxcbiAgICAgICAgcmVnaW9uOiBzdHJpbmcsXG4gICAgICAgIGFjY291bnRfaWQ6IHN0cmluZ1xuICAgICk6IEZ1bmN0aW9uIHtcbiAgICAgICAgcmV0dXJuIG5ldyBGdW5jdGlvbihzY29wZSwgJ21lc3NhZ2UtbGFtYmRhJywge1xuICAgICAgICAgICAgY29kZTogbmV3IEFzc2V0Q29kZSgnLi9zZW5kbWVzc2FnZScpLFxuICAgICAgICAgICAgaGFuZGxlcjogJ2FwcC5oYW5kbGVyJyxcbiAgICAgICAgICAgIHJ1bnRpbWU6IFJ1bnRpbWUuTk9ERUpTXzE0X1gsXG4gICAgICAgICAgICB0aW1lb3V0OiBEdXJhdGlvbi5zZWNvbmRzKDMwMCksXG4gICAgICAgICAgICBtZW1vcnlTaXplOiAyNTYsXG4gICAgICAgICAgICBpbml0aWFsUG9saWN5OiBbXG4gICAgICAgICAgICAgICAgbmV3IFBvbGljeVN0YXRlbWVudCh7XG4gICAgICAgICAgICAgICAgICAgIGFjdGlvbnM6IFsnZXhlY3V0ZS1hcGk6TWFuYWdlQ29ubmVjdGlvbnMnXSxcbiAgICAgICAgICAgICAgICAgICAgcmVzb3VyY2VzOiBbYGFybjphd3M6ZXhlY3V0ZS1hcGk6JHtyZWdpb259OiR7YWNjb3VudF9pZH06JHthcGkucmVmfS8qYF0sXG4gICAgICAgICAgICAgICAgICAgIGVmZmVjdDogRWZmZWN0LkFMTE9XLFxuICAgICAgICAgICAgICAgIH0pXG4gICAgICAgICAgICBdLFxuICAgICAgICAgICAgZW52aXJvbm1lbnQ6IHtcbiAgICAgICAgICAgICAgICBcIlRBQkxFX05BTUVcIjogdGFibGVOYW1lLFxuICAgICAgICAgICAgfVxuICAgICAgICB9KTtcbiAgICB9XG4gICAgZXhwb3J0IGNsYXNzIEF3c1dlYnNvY2tldEFwaVN0YWNrIGV4dGVuZHMgY2RrLlN0YWNrIHtcbiAgICAgIGNvbnN0cnVjdG9yIChzY29wZTogQ29uc3RydWN0LCBpZDogc3RyaW5nLCBwcm9wcz86IGNkay5TdGFja1Byb3BzKSB7XG4gICAgICAgICAgICBzdXBlcihzY29wZSwgaWQsIHByb3BzKTtcbiAgICAgICAgICAgIFxuICAgIFxuICAgICAgICAgICAgXG4gICAgICAgICAgICBjb25zdCBuYW1lID0gaWQgKyBcIi1hcGlcIlxuICAgICAgICAgICAgY29uc3QgYXBpID0gbmV3IENmbkFwaSh0aGlzLCBuYW1lLCB7XG4gICAgICAgICAgICAgICAgbmFtZTogXCJDaGF0QXBwQXBpXCIsXG4gICAgICAgICAgICAgICAgcHJvdG9jb2xUeXBlOiBcIldFQlNPQ0tFVFwiLFxuICAgICAgICAgICAgICAgIHJvdXRlU2VsZWN0aW9uRXhwcmVzc2lvbjogXCIkcmVxdWVzdC5ib2R5LmFjdGlvblwiLFxuICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICBjb25zdCB0YWJsZSA9IG5ldyBUYWJsZSh0aGlzLCBgJHtuYW1lfS10YWJsZWAsIHtcbiAgICAgICAgICAgICAgICB0YWJsZU5hbWU6IHRhYmxlTmFtZSxcbiAgICAgICAgICAgICAgICBwYXJ0aXRpb25LZXk6IHtcbiAgICAgICAgICAgICAgICAgICAgbmFtZTogXCJjb25uZWN0aW9uSWRcIixcbiAgICAgICAgICAgICAgICAgICAgdHlwZTogQXR0cmlidXRlVHlwZS5TVFJJTkcsXG4gICAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAgICByZWFkQ2FwYWNpdHk6IDUsXG4gICAgICAgICAgICAgICAgd3JpdGVDYXBhY2l0eTogNSxcbiAgICAgICAgICAgICAgICByZW1vdmFsUG9saWN5OiBSZW1vdmFsUG9saWN5LkRFU1RST1lcbiAgICAgICAgICAgIH0pO1xuXG4gICAgICAgICBcblxuY29uc3QgY29ubmVjdEZ1bmMgPSBjcmVhdGVMYW1iZGFGdW5jdGlvbih0aGlzLFwiY29ubmVjdC1sYW1iZGFcIiwgXCIuL29uY29ubmVjdFwiKTtcbmNvbnN0IGRpc2Nvbm5lY3RGdW5jID0gY3JlYXRlTGFtYmRhRnVuY3Rpb24odGhpcyxcImRpc2Nvbm5lY3QtbGFtYmRhXCIsIFwiLi9vbmRpc2Nvbm5lY3RcIik7XG5jb25zdCBtZXNzYWdlRnVuYyA9IGNyZWF0ZU1lc3NhZ2VGdW5jdGlvbih0aGlzLCBhcGksIHRhYmxlLCB0YWJsZU5hbWUsIHJlZ2lvbiwgYWNjb3VudF9pZCk7XG5cbi8qY29uc3QgbWVzc2FnZUZ1bmMgPSBjcmVhdGVMYW1iZGFGdW5jdGlvbihcIm1lc3NhZ2UtbGFtYmRhXCIsIFwiLi9zZW5kbWVzc2FnZVwiKTtcbm1lc3NhZ2VGdW5jLmFkZFRvUm9sZVBvbGljeShcbiAgbmV3IFBvbGljeVN0YXRlbWVudCh7XG4gICAgYWN0aW9uczogW1wiZXhlY3V0ZS1hcGk6TWFuYWdlQ29ubmVjdGlvbnNcIl0sXG4gICAgcmVzb3VyY2VzOiBbXG4gICAgICBcImFybjphd3M6ZXhlY3V0ZS1hcGk6XCIgK1xuICAgICAgICBjb25maWdbXCJyZWdpb25cIl0gK1xuICAgICAgICBcIjpcIiArXG4gICAgICAgIGNvbmZpZ1tcImFjY291bnRfaWRcIl0gK1xuICAgICAgICBcIjpcIiArXG4gICAgICAgIGFwaS5yZWYgK1xuICAgICAgICBcIi8qXCIsXG4gICAgXSxcbiAgICBlZmZlY3Q6IEVmZmVjdC5BTExPVyxcbiAgfSlcbik7Ki9cblxudGFibGUuZ3JhbnRSZWFkV3JpdGVEYXRhKGNvbm5lY3RGdW5jKTtcbnRhYmxlLmdyYW50UmVhZFdyaXRlRGF0YShkaXNjb25uZWN0RnVuYyk7XG50YWJsZS5ncmFudFJlYWRXcml0ZURhdGEobWVzc2FnZUZ1bmMpO1xuXG4vKmNvbnN0IG1lc3NhZ2VGdW5jID0gbmV3IEZ1bmN0aW9uKHRoaXMsICdtZXNzYWdlLWxhbWJkYScsIHtcbiAgICBjb2RlOiBuZXcgQXNzZXRDb2RlKCcuL3NlbmRtZXNzYWdlJyksXG4gICAgaGFuZGxlcjogJ2FwcC5oYW5kbGVyJyxcbiAgICBydW50aW1lOiBSdW50aW1lLk5PREVKU18xNF9YLFxuICAgIHRpbWVvdXQ6IER1cmF0aW9uLnNlY29uZHMoMzAwKSxcbiAgICBtZW1vcnlTaXplOiAyNTYsXG4gICAgaW5pdGlhbFBvbGljeTogW1xuICAgICAgICBuZXcgUG9saWN5U3RhdGVtZW50KHtcbiAgICAgICAgICAgIGFjdGlvbnM6IFtcbiAgICAgICAgICAgICAgICAnZXhlY3V0ZS1hcGk6TWFuYWdlQ29ubmVjdGlvbnMnXG4gICAgICAgICAgICBdLFxuICAgICAgICAgICAgcmVzb3VyY2VzOiBbXG4gICAgICAgICAgICAgICAgXCJhcm46YXdzOmV4ZWN1dGUtYXBpOlwiICsgIHJlZ2lvbiArIFwiOlwiICsgIGFjY291bnRfaWQgKyBcIjpcIiArIGFwaS5yZWYgKyBcIi8qXCJcbiAgICAgICAgICAgIF0sXG4gICAgICAgICAgICBlZmZlY3Q6IEVmZmVjdC5BTExPVyxcbiAgICAgICAgfSlcbiAgICBdLFxuICAgIGVudmlyb25tZW50OiB7XG4gICAgICAgIFwiVEFCTEVfTkFNRVwiOiB0YWJsZU5hbWUsXG4gICAgfVxufSk7XG5cbnRhYmxlLmdyYW50UmVhZFdyaXRlRGF0YShtZXNzYWdlRnVuYyk7XG4qL1xuICAgIFxuICAgICAgICAgIC8qICBjb25zdCBjb25uZWN0RnVuYyA9IG5ldyBGdW5jdGlvbih0aGlzLCAnY29ubmVjdC1sYW1iZGEnLCB7XG4gICAgICAgICAgICAgICAgY29kZTogbmV3IEFzc2V0Q29kZSgnLi9vbmNvbm5lY3QnKSxcbiAgICAgICAgICAgICAgICBoYW5kbGVyOiAnYXBwLmhhbmRsZXInLFxuICAgICAgICAgICAgICAgIHJ1bnRpbWU6IFJ1bnRpbWUuTk9ERUpTXzE4X1gsXG4gICAgICAgICAgICAgICAgdGltZW91dDogRHVyYXRpb24uc2Vjb25kcygzMDApLFxuICAgICAgICAgICAgICAgIG1lbW9yeVNpemU6IDI1NixcbiAgICAgICAgICAgICAgICBlbnZpcm9ubWVudDoge1xuICAgICAgICAgICAgICAgICAgICBcIlRBQkxFX05BTUVcIjogdGFibGVOYW1lLFxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0pO1xuICAgIFxuICAgICAgICAgICAgdGFibGUuZ3JhbnRSZWFkV3JpdGVEYXRhKGNvbm5lY3RGdW5jKVxuICAgIFxuICAgICAgICAgICAgY29uc3QgZGlzY29ubmVjdEZ1bmMgPSBuZXcgRnVuY3Rpb24odGhpcywgJ2Rpc2Nvbm5lY3QtbGFtYmRhJywge1xuICAgICAgICAgICAgICAgIGNvZGU6IG5ldyBBc3NldENvZGUoJy4vb25kaXNjb25uZWN0JyksXG4gICAgICAgICAgICAgICAgaGFuZGxlcjogJ2FwcC5oYW5kbGVyJyxcbiAgICAgICAgICAgICAgICBydW50aW1lOiBSdW50aW1lLk5PREVKU18xOF9YLFxuICAgICAgICAgICAgICAgIHRpbWVvdXQ6IER1cmF0aW9uLnNlY29uZHMoMzAwKSxcbiAgICAgICAgICAgICAgICBtZW1vcnlTaXplOiAyNTYsXG4gICAgICAgICAgICAgICAgZW52aXJvbm1lbnQ6IHtcbiAgICAgICAgICAgICAgICAgICAgXCJUQUJMRV9OQU1FXCI6IHRhYmxlTmFtZSxcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9KTtcbiAgICBcbiAgICAgICAgICAgIHRhYmxlLmdyYW50UmVhZFdyaXRlRGF0YShkaXNjb25uZWN0RnVuYylcbiAgICBcbiAgICAgICAgICAgIGNvbnN0IG1lc3NhZ2VGdW5jID0gbmV3IEZ1bmN0aW9uKHRoaXMsICdtZXNzYWdlLWxhbWJkYScsIHtcbiAgICAgICAgICAgICAgICBjb2RlOiBuZXcgQXNzZXRDb2RlKCcuL3NlbmRtZXNzYWdlJyksXG4gICAgICAgICAgICAgICAgaGFuZGxlcjogJ2FwcC5oYW5kbGVyJyxcbiAgICAgICAgICAgICAgICBydW50aW1lOiBSdW50aW1lLk5PREVKU18xOF9YLFxuICAgICAgICAgICAgICAgIHRpbWVvdXQ6IER1cmF0aW9uLnNlY29uZHMoMzAwKSxcbiAgICAgICAgICAgICAgICBtZW1vcnlTaXplOiAyNTYsXG4gICAgICAgICAgICAgICAgaW5pdGlhbFBvbGljeTogW1xuICAgICAgICAgICAgICAgICAgICBuZXcgUG9saWN5U3RhdGVtZW50KHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGFjdGlvbnM6IFtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAnZXhlY3V0ZS1hcGk6TWFuYWdlQ29ubmVjdGlvbnMnXG4gICAgICAgICAgICAgICAgICAgICAgICBdLFxuICAgICAgICAgICAgICAgICAgICAgICAgcmVzb3VyY2VzOiBbXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgXCJhcm46YXdzOmV4ZWN1dGUtYXBpOlwiICsgIHJlZ2lvbiArIFwiOlwiICsgIGFjY291bnRfaWQgKyBcIjpcIiArIGFwaS5yZWYgKyBcIi8qXCJcbiAgICAgICAgICAgICAgICAgICAgICAgIF0sXG4gICAgICAgICAgICAgICAgICAgICAgICBlZmZlY3Q6IEVmZmVjdC5BTExPVyxcbiAgICAgICAgICAgICAgICAgICAgfSlcbiAgICAgICAgICAgICAgICBdLFxuICAgICAgICAgICAgICAgIGVudmlyb25tZW50OiB7XG4gICAgICAgICAgICAgICAgICAgIFwiVEFCTEVfTkFNRVwiOiB0YWJsZU5hbWUsXG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSk7XG4gICAgXG4gICAgICAgICAgICB0YWJsZS5ncmFudFJlYWRXcml0ZURhdGEobWVzc2FnZUZ1bmMpKi9cbiAgICBcbiAgICAgICAgICAgIC8vIGFjY2VzcyByb2xlIGZvciB0aGUgc29ja2V0IGFwaSB0byBhY2Nlc3MgdGhlIHNvY2tldCBsYW1iZGFcbiAgICAgICAgICAgIGNvbnN0IHBvbGljeSA9IG5ldyBQb2xpY3lTdGF0ZW1lbnQoe1xuICAgICAgICAgICAgICAgIGVmZmVjdDogRWZmZWN0LkFMTE9XLFxuICAgICAgICAgICAgICAgIHJlc291cmNlczogW1xuICAgICAgICAgICAgICAgICAgICBjb25uZWN0RnVuYy5mdW5jdGlvbkFybixcbiAgICAgICAgICAgICAgICAgICAgZGlzY29ubmVjdEZ1bmMuZnVuY3Rpb25Bcm4sXG4gICAgICAgICAgICAgICAgICAgIG1lc3NhZ2VGdW5jLmZ1bmN0aW9uQXJuXG4gICAgICAgICAgICAgICAgXSxcbiAgICAgICAgICAgICAgICBhY3Rpb25zOiBbXCJsYW1iZGE6SW52b2tlRnVuY3Rpb25cIl1cbiAgICAgICAgICAgIH0pO1xuICAgIFxuICAgICAgICAgICAgY29uc3Qgcm9sZSA9IG5ldyBSb2xlKHRoaXMsIGAke25hbWV9LWlhbS1yb2xlYCwge1xuICAgICAgICAgICAgICAgIGFzc3VtZWRCeTogbmV3IFNlcnZpY2VQcmluY2lwYWwoXCJhcGlnYXRld2F5LmFtYXpvbmF3cy5jb21cIilcbiAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgcm9sZS5hZGRUb1BvbGljeShwb2xpY3kpO1xuXG4gICAgICAgICAgICBmdW5jdGlvbiBjcmVhdGVMYW1iZGFJbnRlZ3JhdGlvbiggc2NvcGU6IENvbnN0cnVjdCwgLy8gQ2hhbmdlICdhbnknIHRvIHRoZSBhcHByb3ByaWF0ZSB0eXBlIGZvciB5b3VyIENESyBhcHBcbiAgICAgICAgICAgIGFwaTogIENmbkFwaSwgLy8gQ2hhbmdlICdhbnknIHRvIHRoZSBhcHByb3ByaWF0ZSB0eXBlIGZvciB5b3VyIENESyBhcHBcbiAgICAgICAgICAgIGZ1bmN0aW9uTmFtZTogc3RyaW5nLFxuICAgICAgICAgICAgZnVuY3Rpb25Bcm46IHN0cmluZyxcbiAgICAgICAgICAgIHJvbGVBcm46IHN0cmluZykge1xuICAgICAgICAgICAgICAgIHJldHVybiBuZXcgQ2ZuSW50ZWdyYXRpb24oc2NvcGUsIGAke2Z1bmN0aW9uTmFtZX0tbGFtYmRhLWludGVncmF0aW9uYCwge1xuICAgICAgICAgICAgICAgICAgICBhcGlJZDogYXBpLnJlZixcbiAgICAgICAgICAgICAgICAgICAgaW50ZWdyYXRpb25UeXBlOiBcIkFXU19QUk9YWVwiLFxuICAgICAgICAgICAgICAgICAgICBpbnRlZ3JhdGlvblVyaTogYGFybjphd3M6YXBpZ2F0ZXdheToke3JlZ2lvbn06bGFtYmRhOnBhdGgvMjAxNS0wMy0zMS9mdW5jdGlvbnMvJHtmdW5jdGlvbkFybn0vaW52b2NhdGlvbnNgLFxuICAgICAgICAgICAgICAgICAgICBjcmVkZW50aWFsc0Fybjogcm9sZUFybixcbiAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIFxuICAgICAgICAgICAgY29uc3QgY29ubmVjdEludGVncmF0aW9uID0gY3JlYXRlTGFtYmRhSW50ZWdyYXRpb24odGhpcywgYXBpLCBcImNvbm5lY3RcIiwgY29ubmVjdEZ1bmMuZnVuY3Rpb25Bcm4sIHJvbGUucm9sZUFybik7XG4gICAgICAgICAgICBjb25zdCBkaXNjb25uZWN0SW50ZWdyYXRpb24gPSBjcmVhdGVMYW1iZGFJbnRlZ3JhdGlvbih0aGlzLCBhcGksIFwiZGlzY29ubmVjdFwiLCBkaXNjb25uZWN0RnVuYy5mdW5jdGlvbkFybiwgcm9sZS5yb2xlQXJuKTtcbiAgICAgICAgICAgIGNvbnN0IG1lc3NhZ2VJbnRlZ3JhdGlvbiA9IGNyZWF0ZUxhbWJkYUludGVncmF0aW9uKHRoaXMsIGFwaSwgXCJtZXNzYWdlXCIsIG1lc3NhZ2VGdW5jLmZ1bmN0aW9uQXJuLCByb2xlLnJvbGVBcm4pO1xuICAgICAgICAgICAgXG4gICAgXG4gICAgICAgICAgICAvLyBsYW1iZGEgaW50ZWdyYXRpb25cbiAgICAgICAgICAgIC8vIGNvbnN0IGNvbm5lY3RJbnRlZ3JhdGlvbiA9IG5ldyBDZm5JbnRlZ3JhdGlvbih0aGlzLCBcImNvbm5lY3QtbGFtYmRhLWludGVncmF0aW9uXCIsIHtcbiAgICAgICAgICAgIC8vICAgICBhcGlJZDogYXBpLnJlZixcbiAgICAgICAgICAgIC8vICAgICBpbnRlZ3JhdGlvblR5cGU6IFwiQVdTX1BST1hZXCIsXG4gICAgICAgICAgICAvLyAgICAgaW50ZWdyYXRpb25Vcmk6IFwiYXJuOmF3czphcGlnYXRld2F5OlwiICsgcmVnaW9uICsgXCI6bGFtYmRhOnBhdGgvMjAxNS0wMy0zMS9mdW5jdGlvbnMvXCIgKyBjb25uZWN0RnVuYy5mdW5jdGlvbkFybiArIFwiL2ludm9jYXRpb25zXCIsXG4gICAgICAgICAgICAvLyAgICAgY3JlZGVudGlhbHNBcm46IHJvbGUucm9sZUFybixcbiAgICAgICAgICAgIC8vIH0pXG4gICAgICAgICAgICAvLyBjb25zdCBkaXNjb25uZWN0SW50ZWdyYXRpb24gPSBuZXcgQ2ZuSW50ZWdyYXRpb24odGhpcywgXCJkaXNjb25uZWN0LWxhbWJkYS1pbnRlZ3JhdGlvblwiLCB7XG4gICAgICAgICAgICAvLyAgICAgYXBpSWQ6IGFwaS5yZWYsXG4gICAgICAgICAgICAvLyAgICAgaW50ZWdyYXRpb25UeXBlOiBcIkFXU19QUk9YWVwiLFxuICAgICAgICAgICAgLy8gICAgIGludGVncmF0aW9uVXJpOiBcImFybjphd3M6YXBpZ2F0ZXdheTpcIiArIHJlZ2lvbiArIFwiOmxhbWJkYTpwYXRoLzIwMTUtMDMtMzEvZnVuY3Rpb25zL1wiICsgZGlzY29ubmVjdEZ1bmMuZnVuY3Rpb25Bcm4gKyBcIi9pbnZvY2F0aW9uc1wiLFxuICAgICAgICAgICAgLy8gICAgIGNyZWRlbnRpYWxzQXJuOiByb2xlLnJvbGVBcm5cbiAgICAgICAgICAgIC8vIH0pXG4gICAgICAgICAgICAvLyBjb25zdCBtZXNzYWdlSW50ZWdyYXRpb24gPSBuZXcgQ2ZuSW50ZWdyYXRpb24odGhpcywgXCJtZXNzYWdlLWxhbWJkYS1pbnRlZ3JhdGlvblwiLCB7XG4gICAgICAgICAgICAvLyAgICAgYXBpSWQ6IGFwaS5yZWYsXG4gICAgICAgICAgICAvLyAgICAgaW50ZWdyYXRpb25UeXBlOiBcIkFXU19QUk9YWVwiLFxuICAgICAgICAgICAgLy8gICAgIGludGVncmF0aW9uVXJpOiBcImFybjphd3M6YXBpZ2F0ZXdheTpcIiArIHJlZ2lvbiArIFwiOmxhbWJkYTpwYXRoLzIwMTUtMDMtMzEvZnVuY3Rpb25zL1wiICsgbWVzc2FnZUZ1bmMuZnVuY3Rpb25Bcm4gKyBcIi9pbnZvY2F0aW9uc1wiLFxuICAgICAgICAgICAgLy8gICAgIGNyZWRlbnRpYWxzQXJuOiByb2xlLnJvbGVBcm5cbiAgICAgICAgICAgIC8vIH0pXG4gICAgXG4gICAgICAgICAgICAvLyBjb25zdCBjb25uZWN0Um91dGUgPSBuZXcgQ2ZuUm91dGUodGhpcywgXCJjb25uZWN0LXJvdXRlXCIsIHtcbiAgICAgICAgICAgIC8vICAgICBhcGlJZDogYXBpLnJlZixcbiAgICAgICAgICAgIC8vICAgICByb3V0ZUtleTogXCIkY29ubmVjdFwiLFxuICAgICAgICAgICAgLy8gICAgIGF1dGhvcml6YXRpb25UeXBlOiBcIk5PTkVcIixcbiAgICAgICAgICAgIC8vICAgICB0YXJnZXQ6IFwiaW50ZWdyYXRpb25zL1wiICsgY29ubmVjdEludGVncmF0aW9uLnJlZixcbiAgICAgICAgICAgIC8vIH0pO1xuICAgIFxuICAgICAgICAgICAgLy8gY29uc3QgZGlzY29ubmVjdFJvdXRlID0gbmV3IENmblJvdXRlKHRoaXMsIFwiZGlzY29ubmVjdC1yb3V0ZVwiLCB7XG4gICAgICAgICAgICAvLyAgICAgYXBpSWQ6IGFwaS5yZWYsXG4gICAgICAgICAgICAvLyAgICAgcm91dGVLZXk6IFwiJGRpc2Nvbm5lY3RcIixcbiAgICAgICAgICAgIC8vICAgICBhdXRob3JpemF0aW9uVHlwZTogXCJOT05FXCIsXG4gICAgICAgICAgICAvLyAgICAgdGFyZ2V0OiBcImludGVncmF0aW9ucy9cIiArIGRpc2Nvbm5lY3RJbnRlZ3JhdGlvbi5yZWYsXG4gICAgICAgICAgICAvLyB9KTtcbiAgICBcbiAgICAgICAgICAgIC8vIGNvbnN0IG1lc3NhZ2VSb3V0ZSA9IG5ldyBDZm5Sb3V0ZSh0aGlzLCBcIm1lc3NhZ2Utcm91dGVcIiwge1xuICAgICAgICAgICAgLy8gICAgIGFwaUlkOiBhcGkucmVmLFxuICAgICAgICAgICAgLy8gICAgIHJvdXRlS2V5OiBcInNlbmRtZXNzYWdlXCIsXG4gICAgICAgICAgICAvLyAgICAgYXV0aG9yaXphdGlvblR5cGU6IFwiTk9ORVwiLFxuICAgICAgICAgICAgLy8gICAgIHRhcmdldDogXCJpbnRlZ3JhdGlvbnMvXCIgKyBtZXNzYWdlSW50ZWdyYXRpb24ucmVmLFxuICAgICAgICAgICAgLy8gfSk7XG5cbiAgICAgICAgICAgIGZ1bmN0aW9uIGNyZWF0ZVJvdXRlKCBzY29wZTogQ29uc3RydWN0LCAvLyBDaGFuZ2UgJ2FueScgdG8gdGhlIGFwcHJvcHJpYXRlIHR5cGUgZm9yIHlvdXIgQ0RLIGFwcFxuICAgICAgICAgICAgYXBpOiAgQ2ZuQXBpLCAvLyBDaGFuZ2UgJ2FueScgdG8gdGhlIGFwcHJvcHJpYXRlIHR5cGUgZm9yIHlvdXIgQ0RLIGFwcFxuICAgICAgICAgICAgcm91dGVLZXk6IHN0cmluZyxcbiAgICAgICAgICAgIGludGVncmF0aW9uOiBhbnkgKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIG5ldyBDZm5Sb3V0ZShzY29wZSwgYCR7cm91dGVLZXl9LXJvdXRlYCwge1xuICAgICAgICAgICAgICAgICAgICBhcGlJZDogYXBpLnJlZixcbiAgICAgICAgICAgICAgICAgICAgcm91dGVLZXk6IHJvdXRlS2V5LFxuICAgICAgICAgICAgICAgICAgICBhdXRob3JpemF0aW9uVHlwZTogXCJOT05FXCIsXG4gICAgICAgICAgICAgICAgICAgIHRhcmdldDogYGludGVncmF0aW9ucy8ke2ludGVncmF0aW9uLnJlZn1gLFxuICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgXG4gICAgICAgICAgICBjb25zdCBjb25uZWN0Um91dGUgPSBjcmVhdGVSb3V0ZSh0aGlzLCBhcGksIFwiJGNvbm5lY3RcIiwgY29ubmVjdEludGVncmF0aW9uKTtcbiAgICAgICAgICAgIGNvbnN0IGRpc2Nvbm5lY3RSb3V0ZSA9IGNyZWF0ZVJvdXRlKHRoaXMsIGFwaSwgXCIkZGlzY29ubmVjdFwiLCBkaXNjb25uZWN0SW50ZWdyYXRpb24pO1xuICAgICAgICAgICAgY29uc3QgbWVzc2FnZVJvdXRlID0gY3JlYXRlUm91dGUodGhpcywgYXBpLCBcInNlbmRtZXNzYWdlXCIsIG1lc3NhZ2VJbnRlZ3JhdGlvbik7XG4gICAgICAgICAgICBcbiAgICBcbiAgICAgICAgICAgIGNvbnN0IGRlcGxveW1lbnQgPSBuZXcgQ2ZuRGVwbG95bWVudCh0aGlzLCBgJHtuYW1lfS1kZXBsb3ltZW50YCwge1xuICAgICAgICAgICAgICAgIGFwaUlkOiBhcGkucmVmXG4gICAgICAgICAgICB9KTtcbiAgICBcbiAgICAgICAgICAgIG5ldyBDZm5TdGFnZSh0aGlzLCBgJHtuYW1lfS1zdGFnZWAsIHtcbiAgICAgICAgICAgICAgICBhcGlJZDogYXBpLnJlZixcbiAgICAgICAgICAgICAgICBhdXRvRGVwbG95OiB0cnVlLFxuICAgICAgICAgICAgICAgIGRlcGxveW1lbnRJZDogZGVwbG95bWVudC5yZWYsXG4gICAgICAgICAgICAgICAgc3RhZ2VOYW1lOiBcImRldlwiXG4gICAgICAgICAgICB9KTtcbiAgICBcbiAgICAgICAgICAgIGRlcGxveW1lbnQubm9kZS5hZGREZXBlbmRlbmN5KGNvbm5lY3RSb3V0ZSlcbiAgICAgICAgICAgIGRlcGxveW1lbnQubm9kZS5hZGREZXBlbmRlbmN5KGRpc2Nvbm5lY3RSb3V0ZSlcbiAgICAgICAgICAgIGRlcGxveW1lbnQubm9kZS5hZGREZXBlbmRlbmN5KG1lc3NhZ2VSb3V0ZSlcbiAgICAgICAgfVxuICAgIH1cbiAgICBjb25zdCBhcHAgPSBuZXcgQXBwKCk7XG4gICAgbmV3IEF3c1dlYnNvY2tldEFwaVN0YWNrKGFwcCwgYGNoYXQtYXBwYCk7XG4gICAgYXBwLnN5bnRoKCk7XG5cbiAgICAvL3dzY2F0IC1jIHdzczovL3s1NnNzbTRpbHFqfS5leGVjdXRlLWFwaS57dXMtZWFzdC0xfS5hbWF6b25hd3MuY29tL3tlbnZ9Il19