import * as cdk from 'aws-cdk-lib'
import { Construct } from 'constructs'
import { AssetCode, Function, Runtime } from 'aws-cdk-lib/aws-lambda'
import { CfnApi, CfnDeployment, CfnIntegration, CfnRoute, CfnStage } from 'aws-cdk-lib/aws-apigatewayv2'
import { App, Duration, RemovalPolicy, Stack, type StackProps } from 'aws-cdk-lib'
import { Effect, PolicyStatement, Role, ServicePrincipal } from 'aws-cdk-lib/aws-iam'
import { AttributeType, Table } from 'aws-cdk-lib/aws-dynamodb'


import * as config from '../config.json' // has the region name and aws account id

const region = config.region
const account_id = config.account_id 
const tableName = "UserList";


const createLambdaFunction = (Construct: Construct,name: string, codePath: string) => {
    return new Function(Construct, name, {
        code: new AssetCode(codePath),
        handler: "app.handler",
        runtime: Runtime.NODEJS_14_X,
        timeout: Duration.seconds(300),
        memorySize: 256,
        environment: {
        TABLE_NAME: tableName,
        },
    });
    };

    function createMessageFunction(
        scope: Construct,
        api: CfnApi,
        table: Table,
        tableName: string,
        region: string,
        account_id: string
    ): Function {
        return new Function(scope, 'message-lambda', {
            code: new AssetCode('./sendmessage'),
            handler: 'app.handler',
            runtime: Runtime.NODEJS_14_X,
            timeout: Duration.seconds(300),
            memorySize: 256,
            initialPolicy: [
                new PolicyStatement({
                    actions: ['execute-api:ManageConnections'],
                    resources: [`arn:aws:execute-api:${region}:${account_id}:${api.ref}/*`],
                    effect: Effect.ALLOW,
                })
            ],
            environment: {
                "TABLE_NAME": tableName,
            }
        });
    }
    export class AwsWebsocketApiStack extends cdk.Stack {
      constructor (scope: Construct, id: string, props?: cdk.StackProps) {
            super(scope, id, props);

            const name = id + "-api"
            const api = new CfnApi(this, name, {
                name: "ConnectListApi",
                protocolType: "WEBSOCKET",
                routeSelectionExpression: "$request.body.action",
            });
            const table = new Table(this, `${name}-table`, {
                tableName: tableName,
                partitionKey: {
                    name: "connectionId",
                    type: AttributeType.STRING,
                },
                readCapacity: 5,
                writeCapacity: 5,
                removalPolicy: RemovalPolicy.DESTROY
            });

            const connectFunc = createLambdaFunction(this,"connect-lambda", "./onconnect");
            const disconnectFunc = createLambdaFunction(this,"disconnect-lambda", "./ondisconnect");
            const messageFunc = createMessageFunction(this, api, table, tableName, region, account_id);


            table.grantReadWriteData(connectFunc);
            table.grantReadWriteData(disconnectFunc);
            table.grantReadWriteData(messageFunc);

    
            // access role for the socket api to access the socket lambda
            const policy = new PolicyStatement({
                effect: Effect.ALLOW,
                resources: [
                    connectFunc.functionArn,
                    disconnectFunc.functionArn,
                    messageFunc.functionArn
                ],
                actions: ["lambda:InvokeFunction"]
            });
    
            const role = new Role(this, `${name}-iam-role`, {
                assumedBy: new ServicePrincipal("apigateway.amazonaws.com")
            });
            role.addToPolicy(policy);

            function createLambdaIntegration( scope: Construct, 
            api:  CfnApi, 
            functionName: string,
            functionArn: string,
            roleArn: string) {
                return new CfnIntegration(scope, `${functionName}-lambda-integration`, {
                    apiId: api.ref,
                    integrationType: "AWS_PROXY",
                    integrationUri: `arn:aws:apigateway:${region}:lambda:path/2015-03-31/functions/${functionArn}/invocations`,
                    credentialsArn: roleArn,
                });
            }
            
            const connectIntegration = createLambdaIntegration(this, api, "connect", connectFunc.functionArn, role.roleArn);
            const disconnectIntegration = createLambdaIntegration(this, api, "disconnect", disconnectFunc.functionArn, role.roleArn);
            const messageIntegration = createLambdaIntegration(this, api, "sendmessage", messageFunc.functionArn, role.roleArn);

            function createRoute( scope: Construct, 
            api:  CfnApi, 
            routeKey: string,
            integration: any ) {
                return new CfnRoute(scope, `${routeKey}-route`, {
                    apiId: api.ref,
                    routeKey: routeKey,
                    authorizationType: "NONE",
                    target: `integrations/${integration.ref}`,
                });
            }
            
            const connectRoute = createRoute(this, api, "$connect", connectIntegration);
            const disconnectRoute = createRoute(this, api, "$disconnect", disconnectIntegration);
            const messageRoute = createRoute(this, api, "sendmessage", messageIntegration);
            
    
            const deployment = new CfnDeployment(this, `${name}-deployment`, {
                apiId: api.ref
            });
    
            new CfnStage(this, `${name}-stage`, {
                apiId: api.ref,
                autoDeploy: true,
                deploymentId: deployment.ref,
                stageName: "dev"
            });
    
            deployment.node.addDependency(connectRoute)
            deployment.node.addDependency(disconnectRoute)
            deployment.node.addDependency(messageRoute)
        }
    }
    const app = new App();
    new AwsWebsocketApiStack(app, `chat-app`);
    app.synth();

  