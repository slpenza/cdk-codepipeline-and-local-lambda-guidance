import * as cdk from 'aws-cdk-lib';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as path from 'path';

export interface LambdaStackProps extends cdk.StackProps {
  readonly folderName: string
}

export class LambdaStack extends cdk.Stack {
  public readonly function: lambda.IFunction;
  public readonly lambdaFolder  : string
  
  constructor(scope: cdk.App, id: string, props: LambdaStackProps) {
    super(scope, id, props);

    this.lambdaFolder = props.folderName
    const currentDate = new Date().toISOString();

    const func = new lambda.Function(this, 'Lambda', {
      code: lambda.Code.fromAsset(path.join(__dirname, `${props.folderName}`)),
      handler: 'index.handler',
      runtime: lambda.Runtime.NODEJS_12_X,
      description: `Function generated on: ${currentDate}`,
    });
    this.function = func;

  }
}
