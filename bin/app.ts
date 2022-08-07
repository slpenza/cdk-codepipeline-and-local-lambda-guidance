#!/usr/bin/env node

import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { LambdaStack } from "../lib/lambda-stack";
import { InfrastructureStack } from "../lib/infrastructure-stack";
import { CodePipelineStack } from "../lib/codepipeline-stack";

const app = new cdk.App();

/*
 * These can be deployed locally using 'cdk deploy' or through CodePipeline.
 */
const lambdaStack = new LambdaStack(app, 'LambdaStack', {
  folderName: 'lambda-code'
});
const infraStack = new InfrastructureStack(app, 'InfraStack', {
  function: lambdaStack.function,
});

/*
 * This is the production CodePipeline Stack.
 */
new CodePipelineStack(app, 'CodePipelineStack', {
  stacksToDeploy: [
    lambdaStack,
    infraStack
  ],
});
