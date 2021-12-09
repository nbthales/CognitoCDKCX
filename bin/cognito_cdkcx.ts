#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from '@aws-cdk/core';
import { PipelineStack } from '../lib/pipeline/pipeline-stack';


const app = new cdk.App();

new PipelineStack(app, 'CognitoDevPipelineStack', {
  //DEV account
  branch: 'dev',
  awsRegion: 'us-east-1',
  awsAccount: '156343143379',

  env: { //management account
    account: '012916043370',
    region: 'us-east-1'
  }
})

new PipelineStack(app, 'CognitoProdPipelineStack', {
  //PROD account
  branch: 'prod',
  awsRegion: 'us-east-1',
  awsAccount: '385611006416',

  env: { //management account
    account: '012916043370',
    region: 'us-east-1'
  }
})

app.synth()

//cdk bootstrap --profile aws_dev --trust 012916043370 --cloudformation-execution-policies arn:aws:iam::aws:policy/AdministratorAccess aws://156343143379/us-east-1
//cdk bootstrap --profile aws_prod --trust 012916043370 --cloudformation-execution-policies arn:aws:iam::aws:policy/AdministratorAccess aws://385611006416/us-east-1