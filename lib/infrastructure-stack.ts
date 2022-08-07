import * as cdk from 'aws-cdk-lib';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as sns from 'aws-cdk-lib/aws-sns';
import * as sns_subs from 'aws-cdk-lib/aws-sns-subscriptions';

export interface InfrastructureStackProps extends cdk.StackProps {
  readonly function: lambda.IFunction;
}

/**
 * This stack contains infrastructure used by the Lambda function from {@link LambdaStack}.
 * For this example, it's only an SNS Topic,
 * but could be other things as well.
 */
export class InfrastructureStack extends cdk.Stack {
  constructor(scope: cdk.App, id: string, props: InfrastructureStackProps) {
    super(scope, id, props);

    const topic = new sns.Topic(this, 'Topic');
    topic.addSubscription(new sns_subs.LambdaSubscription(props.function));
  }
}
