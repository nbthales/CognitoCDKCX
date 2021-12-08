import * as cdk from "@aws-cdk/core"
import { CodePipeline, CodePipelineSource, ShellStep } from "@aws-cdk/pipelines"

interface PipelineStackProps extends cdk.StackProps {
    branch: string,
    awsAccount: string,
    awsRegion: string
}

export class PipelineStack extends cdk.Stack {
    constructor(scope: cdk.Construct, id: string, props: PipelineStackProps) {
        super(scope, id, props)

        const pipeline = new CodePipeline(this, 'CognitoPipeline'.concat(props.branch), {
            pipelineName: 'CognitoPipeline'.concat(props.branch),
            dockerEnabledForSynth: true,
            crossAccountKeys: true,
            synth: new ShellStep('Synth', {
                input: CodePipelineSource.gitHub('nbthales/CognitoCDKCX', props.branch),
                commands: [
                    'npm ci',
                    'npm run build',
                    'npx cdk synth'
                ]
            })
        })

        //Add the stage here
    }
}