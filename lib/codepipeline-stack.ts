import { Repository  } from 'aws-cdk-lib/aws-codecommit'
import { Artifact, IAction, Pipeline } from 'aws-cdk-lib/aws-codepipeline'
import { BuildSpec, ComputeType, IProject, LinuxBuildImage, PipelineProject } from 'aws-cdk-lib/aws-codebuild'
import { Construct } from 'constructs'
import { CloudFormationCreateUpdateStackAction, CodeBuildAction, CodeCommitSourceAction, CodeCommitTrigger, GitHubSourceAction } from 'aws-cdk-lib/aws-codepipeline-actions'
import { Stack, StackProps, SecretValue } from 'aws-cdk-lib'
import { LambdaStack } from '../lib/lambda-stack'
import { Role, CompositePrincipal, ServicePrincipal, PolicyStatement } from 'aws-cdk-lib/aws-iam'

export interface CodePipelineStackProps extends StackProps {
  readonly stacksToDeploy   : Stack[]
}

export class CodePipelineStack extends Stack {
  constructor(scope: Construct, id: string, props: CodePipelineStackProps) {
    super(scope, id, props)
    
    props.stacksToDeploy.push(this)
    
    // Pipeline Project 
    const buildSpec = {
      version: '0.2',
      phases: {
        install: {
          commands: [
            "npm i -g npm && npm ci"
          ]
        },
        pre_build: {
          commands: [
          ]
        },
        build: {
          commands: [
            'npm run build',
            `npm run cdk synth`
          ],
        },
      },
      artifacts: {
        'base-directory': 'cdk.out',
        files: props.stacksToDeploy.map(i => `${i.stackName}.template.json`)
      },
    };
  
    const projectEnv = {
      computeType: ComputeType.SMALL,
      buildImage: LinuxBuildImage.STANDARD_5_0,
      privileged: true,
    };
    
    var codebuildProject: IProject = new PipelineProject(this, 'CDK_Pipeline_Project', {
      buildSpec: BuildSpec.fromObject(buildSpec),
      environment: projectEnv,
    })

    // CodeCommit Source
    const sourceOutput = new Artifact();
    const sourceAction = new CodeCommitSourceAction({
      actionName: `Source_${this.stackName}`,
      branch: 'dev',
      trigger: CodeCommitTrigger.POLL,
      repository: Repository.fromRepositoryName(this, 'LambdaTest2Ref', 'LambdaTest2'),
      output: sourceOutput,
    });
    
    /*
    const sourceAction = new GitHubSourceAction({
      actionName: 'Source_GitHub',
      output: sourceOutput,
      oauthToken: SecretValue.secretsManager('my-github-token'),
      owner: 'skinny85',
      repo: 'cdk-codepipeline-and-local-lambda-guidance',
    })
    */
    
    const buildOutput: Artifact = new Artifact('CdkBuildOutput')
    const buildActions: IAction[] = [new CodeBuildAction({
      actionName: 'CDK_Build_Action',
      project: codebuildProject,
      input: sourceOutput,
      outputs: [buildOutput],
    })]
    
    const deployActions: IAction[] = []
    const role: Role = new Role(this, 'LambdaBuildRole', {
      assumedBy: new ServicePrincipal('codebuild.amazonaws.com'),
      description: "Workaround for 'cdk-assets' authentication",
      roleName: 'LambdaBuildRole',
    })
    role.addToPolicy(new PolicyStatement({
      actions: ['*'],
      resources: ['*'],
    }));
    
    for (let stack of props.stacksToDeploy) {
    
      if (stack instanceof LambdaStack ) {
        
        const buildSpecLambda = {
          version: '0.2',
          phases: {
            install: {
              commands: [
                `cd lib/${stack.lambdaFolder}`,
                `npm install`,
                `cd ../..`,
                `npm i -g npm && npm ci`,
                `npm install -g cdk-assets`,
              ],
            },
            pre_build: {
              commands: [
                `npm run build`,
                `npm run cdk synth ${stack.stackName}`,
              ]
            },
            build: {
              commands: [
                `cdk-assets -p cdk.out/${stack.stackName}.assets.json publish`
              ]
            },
          },
          artifacts: {
            'base-directory': `cdk.out`,
            files: [
              `${stack.stackName}.template.json`,
            ],
          },
        }
        
        codebuildProject = new PipelineProject(this, 'Pipeline_Project', {
          buildSpec: BuildSpec.fromObject(buildSpecLambda),
          environment: projectEnv,
          projectName: 'Pipeline_Project',
          role: role,
        })
        

        const buildOutputLambda = new Artifact()
        var action:IAction = new CodeBuildAction({
          actionName: `Build_${stack.stackName}`,
          project: codebuildProject,
          input: sourceOutput,
          outputs: [buildOutputLambda],
        });
        buildActions.push(action)
        
        action = new CloudFormationCreateUpdateStackAction({
          actionName: `Deploy_${stack.stackName}`,
          templatePath: buildOutputLambda.atPath(`${stack.stackName}.template.json`),
          stackName: stack.stackName,
          adminPermissions: true,
        });
        deployActions.push(action);
            
      } else {
        
        action = new CloudFormationCreateUpdateStackAction({
          actionName: `Deploy_${stack.stackName}`,
          templatePath: buildOutput.atPath(stack.stackName + '.template.json'),
          stackName: stack.stackName,
          adminPermissions: true,
        })
        deployActions.push(action);
  
      }
    }

    const pipeline = new Pipeline(this, 'Pipeline', {
      pipelineName: 'ProdCdkCodePipelineForLocalLambdaDevGuidance',
    })
    pipeline.addStage({
      stageName: `Source`,
      actions: [sourceAction]
    });
    pipeline.addStage({
      stageName: "Build",
      actions: buildActions
    })
    pipeline.addStage({
      stageName: "Deploy",
      actions: deployActions
    });

  }
}