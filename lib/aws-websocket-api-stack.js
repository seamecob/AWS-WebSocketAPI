"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AwsWebsocketApiStack = void 0;
const cdk = require("aws-cdk-lib");
const aws_lambda_1 = require("aws-cdk-lib/aws-lambda");
const aws_apigatewayv2_1 = require("aws-cdk-lib/aws-apigatewayv2");
const aws_cdk_lib_1 = require("aws-cdk-lib");
const aws_iam_1 = require("aws-cdk-lib/aws-iam");
const aws_dynamodb_1 = require("aws-cdk-lib/aws-dynamodb");
const config = require("../config.json"); // has the region name and aws account id
const region = config.region;
const account_id = config.account_id;
const tableName = "UserList";
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
            name: "ConnectListApi",
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
        table.grantReadWriteData(connectFunc);
        table.grantReadWriteData(disconnectFunc);
        table.grantReadWriteData(messageFunc);
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
        function createLambdaIntegration(scope, api, functionName, functionArn, roleArn) {
            return new aws_apigatewayv2_1.CfnIntegration(scope, `${functionName}-lambda-integration`, {
                apiId: api.ref,
                integrationType: "AWS_PROXY",
                integrationUri: `arn:aws:apigateway:${region}:lambda:path/2015-03-31/functions/${functionArn}/invocations`,
                credentialsArn: roleArn,
            });
        }
        const connectIntegration = createLambdaIntegration(this, api, "connect", connectFunc.functionArn, role.roleArn);
        const disconnectIntegration = createLambdaIntegration(this, api, "disconnect", disconnectFunc.functionArn, role.roleArn);
        const messageIntegration = createLambdaIntegration(this, api, "sendmessage", messageFunc.functionArn, role.roleArn);
        function createRoute(scope, api, routeKey, integration) {
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYXdzLXdlYnNvY2tldC1hcGktc3RhY2suanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyJhd3Mtd2Vic29ja2V0LWFwaS1zdGFjay50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7QUFBQSxtQ0FBa0M7QUFFbEMsdURBQXFFO0FBQ3JFLG1FQUF3RztBQUN4Ryw2Q0FBa0Y7QUFDbEYsaURBQXFGO0FBQ3JGLDJEQUErRDtBQUcvRCx5Q0FBd0MsQ0FBQyx5Q0FBeUM7QUFFbEYsTUFBTSxNQUFNLEdBQUcsTUFBTSxDQUFDLE1BQU0sQ0FBQTtBQUM1QixNQUFNLFVBQVUsR0FBRyxNQUFNLENBQUMsVUFBVSxDQUFBO0FBQ3BDLE1BQU0sU0FBUyxHQUFHLFVBQVUsQ0FBQztBQUc3QixNQUFNLG9CQUFvQixHQUFHLENBQUMsU0FBb0IsRUFBQyxJQUFZLEVBQUUsUUFBZ0IsRUFBRSxFQUFFO0lBQ2pGLE9BQU8sSUFBSSxxQkFBUSxDQUFDLFNBQVMsRUFBRSxJQUFJLEVBQUU7UUFDakMsSUFBSSxFQUFFLElBQUksc0JBQVMsQ0FBQyxRQUFRLENBQUM7UUFDN0IsT0FBTyxFQUFFLGFBQWE7UUFDdEIsT0FBTyxFQUFFLG9CQUFPLENBQUMsV0FBVztRQUM1QixPQUFPLEVBQUUsc0JBQVEsQ0FBQyxPQUFPLENBQUMsR0FBRyxDQUFDO1FBQzlCLFVBQVUsRUFBRSxHQUFHO1FBQ2YsV0FBVyxFQUFFO1lBQ2IsVUFBVSxFQUFFLFNBQVM7U0FDcEI7S0FDSixDQUFDLENBQUM7QUFDSCxDQUFDLENBQUM7QUFFRixTQUFTLHFCQUFxQixDQUMxQixLQUFnQixFQUNoQixHQUFXLEVBQ1gsS0FBWSxFQUNaLFNBQWlCLEVBQ2pCLE1BQWMsRUFDZCxVQUFrQjtJQUVsQixPQUFPLElBQUkscUJBQVEsQ0FBQyxLQUFLLEVBQUUsZ0JBQWdCLEVBQUU7UUFDekMsSUFBSSxFQUFFLElBQUksc0JBQVMsQ0FBQyxlQUFlLENBQUM7UUFDcEMsT0FBTyxFQUFFLGFBQWE7UUFDdEIsT0FBTyxF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LEdBQUcsV0FBVyxDQUFDLElBQUksRUFBRSxHQUFHLEVBQUUsYUFBYSxFQUFFLGtCQUFrQixDQUFDLENBQUM7UUFHL0UsTUFBTSxVQUFVLEdBQUcsSUFBSSxnQ0FBYSxDQUFDLElBQUksRUFBRSxHQUFHLElBQUksYUFBYSxFQUFFO1lBQzdELEtBQUssRUFBRSxHQUFHLENBQUMsR0FBRztTQUNqQixDQUFDLENBQUM7UUFFSCxJQUFJLDJCQUFRLENBQUMsSUFBSSxFQUFFLEdBQUcsSUFBSSxRQUFRLEVBQUU7WUFDaEMsS0FBSyxFQUFFLEdBQUcsQ0FBQyxHQUFHO1lBQ2QsVUFBVSxFQUFFLElBQUk7WUFDaEIsWUFBWSxFQUFFLFVBQVUsQ0FBQyxHQUFHO1lBQzVCLFNBQVMsRUFBRSxLQUFLO1NBQ25CLENBQUMsQ0FBQztRQUVILFVBQVUsQ0FBQyxJQUFJLENBQUMsYUFBYSxDQUFDLFlBQVksQ0FBQyxDQUFBO1FBQzNDLFVBQVUsQ0FBQyxJQUFJLENBQUMsYUFBYSxDQUFDLGVBQWUsQ0FBQyxDQUFBO1FBQzlDLFVBQVUsQ0FBQyxJQUFJLENBQUMsYUFBYSxDQUFDLFlBQVksQ0FBQyxDQUFBO0lBQy9DLENBQUM7Q0FDSjtBQWhHRCxvREFnR0M7QUFDRCxNQUFNLEdBQUcsR0FBRyxJQUFJLGlCQUFHLEVBQUUsQ0FBQztBQUN0QixJQUFJLG9CQUFvQixDQUFDLEdBQUcsRUFBRSxVQUFVLENBQUMsQ0FBQztBQUMxQyxHQUFHLENBQUMsS0FBSyxFQUFFLENBQUMiLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgKiBhcyBjZGsgZnJvbSAnYXdzLWNkay1saWInXG5pbXBvcnQgeyBDb25zdHJ1Y3QgfSBmcm9tICdjb25zdHJ1Y3RzJ1xuaW1wb3J0IHsgQXNzZXRDb2RlLCBGdW5jdGlvbiwgUnVudGltZSB9IGZyb20gJ2F3cy1jZGstbGliL2F3cy1sYW1iZGEnXG5pbXBvcnQgeyBDZm5BcGksIENmbkRlcGxveW1lbnQsIENmbkludGVncmF0aW9uLCBDZm5Sb3V0ZSwgQ2ZuU3RhZ2UgfSBmcm9tICdhd3MtY2RrLWxpYi9hd3MtYXBpZ2F0ZXdheXYyJ1xuaW1wb3J0IHsgQXBwLCBEdXJhdGlvbiwgUmVtb3ZhbFBvbGljeSwgU3RhY2ssIHR5cGUgU3RhY2tQcm9wcyB9IGZyb20gJ2F3cy1jZGstbGliJ1xuaW1wb3J0IHsgRWZmZWN0LCBQb2xpY3lTdGF0ZW1lbnQsIFJvbGUsIFNlcnZpY2VQcmluY2lwYWwgfSBmcm9tICdhd3MtY2RrLWxpYi9hd3MtaWFtJ1xuaW1wb3J0IHsgQXR0cmlidXRlVHlwZSwgVGFibGUgfSBmcm9tICdhd3MtY2RrLWxpYi9hd3MtZHluYW1vZGInXG5cblxuaW1wb3J0ICogYXMgY29uZmlnIGZyb20gJy4uL2NvbmZpZy5qc29uJyAvLyBoYXMgdGhlIHJlZ2lvbiBuYW1lIGFuZCBhd3MgYWNjb3VudCBpZFxuXG5jb25zdCByZWdpb24gPSBjb25maWcucmVnaW9uXG5jb25zdCBhY2NvdW50X2lkID0gY29uZmlnLmFjY291bnRfaWQgXG5jb25zdCB0YWJsZU5hbWUgPSBcIlVzZXJMaXN0XCI7XG5cblxuY29uc3QgY3JlYXRlTGFtYmRhRnVuY3Rpb24gPSAoQ29uc3RydWN0OiBDb25zdHJ1Y3QsbmFtZTogc3RyaW5nLCBjb2RlUGF0aDogc3RyaW5nKSA9PiB7XG4gICAgcmV0dXJuIG5ldyBGdW5jdGlvbihDb25zdHJ1Y3QsIG5hbWUsIHtcbiAgICAgICAgY29kZTogbmV3IEFzc2V0Q29kZShjb2RlUGF0aCksXG4gICAgICAgIGhhbmRsZXI6IFwiYXBwLmhhbmRsZXJcIixcbiAgICAgICAgcnVudGltZTogUnVudGltZS5OT0RFSlNfMTRfWCxcbiAgICAgICAgdGltZW91dDogRHVyYXRpb24uc2Vjb25kcygzMDApLFxuICAgICAgICBtZW1vcnlTaXplOiAyNTYsXG4gICAgICAgIGVudmlyb25tZW50OiB7XG4gICAgICAgIFRBQkxFX05BTUU6IHRhYmxlTmFtZSxcbiAgICAgICAgfSxcbiAgICB9KTtcbiAgICB9O1xuXG4gICAgZnVuY3Rpb24gY3JlYXRlTWVzc2FnZUZ1bmN0aW9uKFxuICAgICAgICBzY29wZTogQ29uc3RydWN0LFxuICAgICAgICBhcGk6IENmbkFwaSxcbiAgICAgICAgdGFibGU6IFRhYmxlLFxuICAgICAgICB0YWJsZU5hbWU6IHN0cmluZyxcbiAgICAgICAgcmVnaW9uOiBzdHJpbmcsXG4gICAgICAgIGFjY291bnRfaWQ6IHN0cmluZ1xuICAgICk6IEZ1bmN0aW9uIHtcbiAgICAgICAgcmV0dXJuIG5ldyBGdW5jdGlvbihzY29wZSwgJ21lc3NhZ2UtbGFtYmRhJywge1xuICAgICAgICAgICAgY29kZTogbmV3IEFzc2V0Q29kZSgnLi9zZW5kbWVzc2FnZScpLFxuICAgICAgICAgICAgaGFuZGxlcjogJ2FwcC5oYW5kbGVyJyxcbiAgICAgICAgICAgIHJ1bnRpbWU6IFJ1bnRpbWUuTk9ERUpTXzE0X1gsXG4gICAgICAgICAgICB0aW1lb3V0OiBEdXJhdGlvbi5zZWNvbmRzKDMwMCksXG4gICAgICAgICAgICBtZW1vcnlTaXplOiAyNTYsXG4gICAgICAgICAgICBpbml0aWFsUG9saWN5OiBbXG4gICAgICAgICAgICAgICAgbmV3IFBvbGljeVN0YXRlbWVudCh7XG4gICAgICAgICAgICAgICAgICAgIGFjdGlvbnM6IFsnZXhlY3V0ZS1hcGk6TWFuYWdlQ29ubmVjdGlvbnMnXSxcbiAgICAgICAgICAgICAgICAgICAgcmVzb3VyY2VzOiBbYGFybjphd3M6ZXhlY3V0ZS1hcGk6JHtyZWdpb259OiR7YWNjb3VudF9pZH06JHthcGkucmVmfS8qYF0sXG4gICAgICAgICAgICAgICAgICAgIGVmZmVjdDogRWZmZWN0LkFMTE9XLFxuICAgICAgICAgICAgICAgIH0pXG4gICAgICAgICAgICBdLFxuICAgICAgICAgICAgZW52aXJvbm1lbnQ6IHtcbiAgICAgICAgICAgICAgICBcIlRBQkxFX05BTUVcIjogdGFibGVOYW1lLFxuICAgICAgICAgICAgfVxuICAgICAgICB9KTtcbiAgICB9XG4gICAgZXhwb3J0IGNsYXNzIEF3c1dlYnNvY2tldEFwaVN0YWNrIGV4dGVuZHMgY2RrLlN0YWNrIHtcbiAgICAgIGNvbnN0cnVjdG9yIChzY29wZTogQ29uc3RydWN0LCBpZDogc3RyaW5nLCBwcm9wcz86IGNkay5TdGFja1Byb3BzKSB7XG4gICAgICAgICAgICBzdXBlcihzY29wZSwgaWQsIHByb3BzKTtcblxuICAgICAgICAgICAgY29uc3QgbmFtZSA9IGlkICsgXCItYXBpXCJcbiAgICAgICAgICAgIGNvbnN0IGFwaSA9IG5ldyBDZm5BcGkodGhpcywgbmFtZSwge1xuICAgICAgICAgICAgICAgIG5hbWU6IFwiQ29ubmVjdExpc3RBcGlcIixcbiAgICAgICAgICAgICAgICBwcm90b2NvbFR5cGU6IFwiV0VCU09DS0VUXCIsXG4gICAgICAgICAgICAgICAgcm91dGVTZWxlY3Rpb25FeHByZXNzaW9uOiBcIiRyZXF1ZXN0LmJvZHkuYWN0aW9uXCIsXG4gICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIGNvbnN0IHRhYmxlID0gbmV3IFRhYmxlKHRoaXMsIGAke25hbWV9LXRhYmxlYCwge1xuICAgICAgICAgICAgICAgIHRhYmxlTmFtZTogdGFibGVOYW1lLFxuICAgICAgICAgICAgICAgIHBhcnRpdGlvbktleToge1xuICAgICAgICAgICAgICAgICAgICBuYW1lOiBcImNvbm5lY3Rpb25JZFwiLFxuICAgICAgICAgICAgICAgICAgICB0eXBlOiBBdHRyaWJ1dGVUeXBlLlNUUklORyxcbiAgICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICAgIHJlYWRDYXBhY2l0eTogNSxcbiAgICAgICAgICAgICAgICB3cml0ZUNhcGFjaXR5OiA1LFxuICAgICAgICAgICAgICAgIHJlbW92YWxQb2xpY3k6IFJlbW92YWxQb2xpY3kuREVTVFJPWVxuICAgICAgICAgICAgfSk7XG5cbiAgICAgICAgICAgIGNvbnN0IGNvbm5lY3RGdW5jID0gY3JlYXRlTGFtYmRhRnVuY3Rpb24odGhpcyxcImNvbm5lY3QtbGFtYmRhXCIsIFwiLi9vbmNvbm5lY3RcIik7XG4gICAgICAgICAgICBjb25zdCBkaXNjb25uZWN0RnVuYyA9IGNyZWF0ZUxhbWJkYUZ1bmN0aW9uKHRoaXMsXCJkaXNjb25uZWN0LWxhbWJkYVwiLCBcIi4vb25kaXNjb25uZWN0XCIpO1xuICAgICAgICAgICAgY29uc3QgbWVzc2FnZUZ1bmMgPSBjcmVhdGVNZXNzYWdlRnVuY3Rpb24odGhpcywgYXBpLCB0YWJsZSwgdGFibGVOYW1lLCByZWdpb24sIGFjY291bnRfaWQpO1xuXG5cbiAgICAgICAgICAgIHRhYmxlLmdyYW50UmVhZFdyaXRlRGF0YShjb25uZWN0RnVuYyk7XG4gICAgICAgICAgICB0YWJsZS5ncmFudFJlYWRXcml0ZURhdGEoZGlzY29ubmVjdEZ1bmMpO1xuICAgICAgICAgICAgdGFibGUuZ3JhbnRSZWFkV3JpdGVEYXRhKG1lc3NhZ2VGdW5jKTtcblxuICAgIFxuICAgICAgICAgICAgLy8gYWNjZXNzIHJvbGUgZm9yIHRoZSBzb2NrZXQgYXBpIHRvIGFjY2VzcyB0aGUgc29ja2V0IGxhbWJkYVxuICAgICAgICAgICAgY29uc3QgcG9saWN5ID0gbmV3IFBvbGljeVN0YXRlbWVudCh7XG4gICAgICAgICAgICAgICAgZWZmZWN0OiBFZmZlY3QuQUxMT1csXG4gICAgICAgICAgICAgICAgcmVzb3VyY2VzOiBbXG4gICAgICAgICAgICAgICAgICAgIGNvbm5lY3RGdW5jLmZ1bmN0aW9uQXJuLFxuICAgICAgICAgICAgICAgICAgICBkaXNjb25uZWN0RnVuYy5mdW5jdGlvbkFybixcbiAgICAgICAgICAgICAgICAgICAgbWVzc2FnZUZ1bmMuZnVuY3Rpb25Bcm5cbiAgICAgICAgICAgICAgICBdLFxuICAgICAgICAgICAgICAgIGFjdGlvbnM6IFtcImxhbWJkYTpJbnZva2VGdW5jdGlvblwiXVxuICAgICAgICAgICAgfSk7XG4gICAgXG4gICAgICAgICAgICBjb25zdCByb2xlID0gbmV3IFJvbGUodGhpcywgYCR7bmFtZX0taWFtLXJvbGVgLCB7XG4gICAgICAgICAgICAgICAgYXNzdW1lZEJ5OiBuZXcgU2VydmljZVByaW5jaXBhbChcImFwaWdhdGV3YXkuYW1hem9uYXdzLmNvbVwiKVxuICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICByb2xlLmFkZFRvUG9saWN5KHBvbGljeSk7XG5cbiAgICAgICAgICAgIGZ1bmN0aW9uIGNyZWF0ZUxhbWJkYUludGVncmF0aW9uKCBzY29wZTogQ29uc3RydWN0LCBcbiAgICAgICAgICAgIGFwaTogIENmbkFwaSwgXG4gICAgICAgICAgICBmdW5jdGlvbk5hbWU6IHN0cmluZyxcbiAgICAgICAgICAgIGZ1bmN0aW9uQXJuOiBzdHJpbmcsXG4gICAgICAgICAgICByb2xlQXJuOiBzdHJpbmcpIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gbmV3IENmbkludGVncmF0aW9uKHNjb3BlLCBgJHtmdW5jdGlvbk5hbWV9LWxhbWJkYS1pbnRlZ3JhdGlvbmAsIHtcbiAgICAgICAgICAgICAgICAgICAgYXBpSWQ6IGFwaS5yZWYsXG4gICAgICAgICAgICAgICAgICAgIGludGVncmF0aW9uVHlwZTogXCJBV1NfUFJPWFlcIixcbiAgICAgICAgICAgICAgICAgICAgaW50ZWdyYXRpb25Vcmk6IGBhcm46YXdzOmFwaWdhdGV3YXk6JHtyZWdpb259OmxhbWJkYTpwYXRoLzIwMTUtMDMtMzEvZnVuY3Rpb25zLyR7ZnVuY3Rpb25Bcm59L2ludm9jYXRpb25zYCxcbiAgICAgICAgICAgICAgICAgICAgY3JlZGVudGlhbHNBcm46IHJvbGVBcm4sXG4gICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBcbiAgICAgICAgICAgIGNvbnN0IGNvbm5lY3RJbnRlZ3JhdGlvbiA9IGNyZWF0ZUxhbWJkYUludGVncmF0aW9uKHRoaXMsIGFwaSwgXCJjb25uZWN0XCIsIGNvbm5lY3RGdW5jLmZ1bmN0aW9uQXJuLCByb2xlLnJvbGVBcm4pO1xuICAgICAgICAgICAgY29uc3QgZGlzY29ubmVjdEludGVncmF0aW9uID0gY3JlYXRlTGFtYmRhSW50ZWdyYXRpb24odGhpcywgYXBpLCBcImRpc2Nvbm5lY3RcIiwgZGlzY29ubmVjdEZ1bmMuZnVuY3Rpb25Bcm4sIHJvbGUucm9sZUFybik7XG4gICAgICAgICAgICBjb25zdCBtZXNzYWdlSW50ZWdyYXRpb24gPSBjcmVhdGVMYW1iZGFJbnRlZ3JhdGlvbih0aGlzLCBhcGksIFwic2VuZG1lc3NhZ2VcIiwgbWVzc2FnZUZ1bmMuZnVuY3Rpb25Bcm4sIHJvbGUucm9sZUFybik7XG5cbiAgICAgICAgICAgIGZ1bmN0aW9uIGNyZWF0ZVJvdXRlKCBzY29wZTogQ29uc3RydWN0LCBcbiAgICAgICAgICAgIGFwaTogIENmbkFwaSwgXG4gICAgICAgICAgICByb3V0ZUtleTogc3RyaW5nLFxuICAgICAgICAgICAgaW50ZWdyYXRpb246IGFueSApIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gbmV3IENmblJvdXRlKHNjb3BlLCBgJHtyb3V0ZUtleX0tcm91dGVgLCB7XG4gICAgICAgICAgICAgICAgICAgIGFwaUlkOiBhcGkucmVmLFxuICAgICAgICAgICAgICAgICAgICByb3V0ZUtleTogcm91dGVLZXksXG4gICAgICAgICAgICAgICAgICAgIGF1dGhvcml6YXRpb25UeXBlOiBcIk5PTkVcIixcbiAgICAgICAgICAgICAgICAgICAgdGFyZ2V0OiBgaW50ZWdyYXRpb25zLyR7aW50ZWdyYXRpb24ucmVmfWAsXG4gICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBcbiAgICAgICAgICAgIGNvbnN0IGNvbm5lY3RSb3V0ZSA9IGNyZWF0ZVJvdXRlKHRoaXMsIGFwaSwgXCIkY29ubmVjdFwiLCBjb25uZWN0SW50ZWdyYXRpb24pO1xuICAgICAgICAgICAgY29uc3QgZGlzY29ubmVjdFJvdXRlID0gY3JlYXRlUm91dGUodGhpcywgYXBpLCBcIiRkaXNjb25uZWN0XCIsIGRpc2Nvbm5lY3RJbnRlZ3JhdGlvbik7XG4gICAgICAgICAgICBjb25zdCBtZXNzYWdlUm91dGUgPSBjcmVhdGVSb3V0ZSh0aGlzLCBhcGksIFwic2VuZG1lc3NhZ2VcIiwgbWVzc2FnZUludGVncmF0aW9uKTtcbiAgICAgICAgICAgIFxuICAgIFxuICAgICAgICAgICAgY29uc3QgZGVwbG95bWVudCA9IG5ldyBDZm5EZXBsb3ltZW50KHRoaXMsIGAke25hbWV9LWRlcGxveW1lbnRgLCB7XG4gICAgICAgICAgICAgICAgYXBpSWQ6IGFwaS5yZWZcbiAgICAgICAgICAgIH0pO1xuICAgIFxuICAgICAgICAgICAgbmV3IENmblN0YWdlKHRoaXMsIGAke25hbWV9LXN0YWdlYCwge1xuICAgICAgICAgICAgICAgIGFwaUlkOiBhcGkucmVmLFxuICAgICAgICAgICAgICAgIGF1dG9EZXBsb3k6IHRydWUsXG4gICAgICAgICAgICAgICAgZGVwbG95bWVudElkOiBkZXBsb3ltZW50LnJlZixcbiAgICAgICAgICAgICAgICBzdGFnZU5hbWU6IFwiZGV2XCJcbiAgICAgICAgICAgIH0pO1xuICAgIFxuICAgICAgICAgICAgZGVwbG95bWVudC5ub2RlLmFkZERlcGVuZGVuY3koY29ubmVjdFJvdXRlKVxuICAgICAgICAgICAgZGVwbG95bWVudC5ub2RlLmFkZERlcGVuZGVuY3koZGlzY29ubmVjdFJvdXRlKVxuICAgICAgICAgICAgZGVwbG95bWVudC5ub2RlLmFkZERlcGVuZGVuY3kobWVzc2FnZVJvdXRlKVxuICAgICAgICB9XG4gICAgfVxuICAgIGNvbnN0IGFwcCA9IG5ldyBBcHAoKTtcbiAgICBuZXcgQXdzV2Vic29ja2V0QXBpU3RhY2soYXBwLCBgY2hhdC1hcHBgKTtcbiAgICBhcHAuc3ludGgoKTtcblxuICAiXX0=