import {
  JupyterFrontEnd,
  JupyterFrontEndPlugin
} from '@jupyterlab/application';

import {CodeCellModel, isCodeCellModel} from '@jupyterlab/cells';
import {ICommandPalette, MainAreaWidget} from "@jupyterlab/apputils";
import {INotebookTracker, Notebook, NotebookActions, NotebookTracker} from '@jupyterlab/notebook'
import {Widget} from '@lumino/widgets';
import {IOutput} from '@jupyterlab/nbformat'
import {PageConfig} from '@jupyterlab/coreutils';
import {IRenderMimeRegistry} from "@jupyterlab/rendermime";

// The backend now decides, per attempt, whether a hint is given at all and
// which kind (workedExample-style or instructionalText-style), based on the
// student's live Grey Area zone for this cell's KC -- see logService.py's
// askLLM(). This extension used to be workedExample-only (a single fixed
// supportType, a single hintCounter); it's now the merged "adaptiveSupport"
// extension and hosts both hint styles. instructionalTextExtension is
// retired (see Dockerfile) since this extension supersedes it.
interface LLMResponse {
  LLMResponse: string | null;
  feedbackWithheld?: boolean;
  greyAreaZone?: string | null; // "above" | "below" | "in" | null
  hintTypeUsed?: string | null; // "workedExample" | "instructionalText" | null
  hintNumber?: number | null; // cumulative 1-6 across both hint types, for display
}

const supportType="adaptiveSupport"

class LLMResponseWidget extends Widget{
  private widgetContainer: HTMLElement;
 // private _rendermime:IRenderMimeRegistry;
  //private renderer:IRenderMime.IRenderer;
  constructor() {
    super();
    //this.node.appendChild(renderer.node);
  //  this._rendermime= rendermime;
    this.addClass('LLM-responseWidget');
    this.widgetContainer = document.createElement('div');
    this.widgetContainer.classList.add('widget-container')
    //const introduction = document.createElement('p');
    //introduction.textContent = 'This is introductionary text, explaining the functionality of the service';
    //this.widgetContainer.appendChild(introduction);
    this.node.appendChild(this.widgetContainer);
    //this.renderer= this._rendermime.createRenderer('text/markdown');

  }
  clearPrompt(): void {

    if (this.widgetContainer && this.widgetContainer.parentNode){
      this.widgetContainer.parentNode.removeChild(this.widgetContainer)
    }

    this.widgetContainer = document.createElement('div');
    this.widgetContainer.classList.add('widget-container')
    this.node.appendChild(this.widgetContainer);
  }

  // cellModel is passed in so this method can bump whichever per-type hint
  // counter actually got used, once the backend's response tells us. The
  // two counters (hintCounterWorkedExample / hintCounterInstructional) are
  // independent and both live in cell metadata, since a student can cross
  // zones across attempts on the same cell (e.g. workedExample hints while
  // "in", then instructionalText hints after dropping "below").
  async updateWidget(cellModel:any, execution_count:number,cellIdentifier:any,error: IOutput,sourceCode: String, hintCounterWorkedExample: number, hintCounterInstructional: number, taskDescriptionContent:String,rendermime: IRenderMimeRegistry, KC: String): Promise<void>{
      const executionCounter=execution_count.toString()
      const traceback = error['traceback']?.toString()??'UndefinedErrorValue';
      const errorName = error['ename']?.toString()??'UndefinedErrorValue';
      const errorMessage = error['evalue']?.toString()??'UndefinedErrorValue';

      // Show a lightweight waiting indicator immediately. It gets removed
      // once the response arrives, and replaced with real content only if
      // the backend actually returns something to show -- a capped attempt
      // (this zone's 3 hints already used, still in the same zone) returns
      // no LLMResponse at all, and per design nothing is shown for that.
      const waitingNode=document.createElement('div');
      waitingNode.classList.add('error-container');
      const waitingRenderer= rendermime.createRenderer('text/markdown');
      waitingRenderer.node.classList.add('error-LLMDescription');
      waitingNode.appendChild(waitingRenderer.node);
      this.widgetContainer.appendChild(waitingNode);
      const waitingModel = rendermime.createModel({
        data: { 'text/markdown': "#### Waiting for response from LLM..." }, trusted: false
      })
      await waitingRenderer.renderModel(waitingModel);

      try {
        const data = await askLLM(executionCounter,cellIdentifier,errorName,errorMessage,traceback,sourceCode, hintCounterWorkedExample, hintCounterInstructional, taskDescriptionContent, KC) as LLMResponse;

        if (waitingNode.parentNode) {
          waitingNode.parentNode.removeChild(waitingNode);
        }

        if (!data['LLMResponse']) {
          // Capped-in-the-same-zone: nothing is shown at all. The student
          // needs to either keep practicing until the zone changes, or
          // move to the other zone to start getting the other hint type
          // instead (numbered starting from where this one left off, out
          // of 6 total). Which zone maps to which hint type is decided
          // entirely server-side (see logService.py's askLLM) -- this
          // extension just renders whatever hintTypeUsed comes back.
          return;
        }

        // Bump whichever counter this hint actually counted against. The
        // "above" zone message (hintTypeUsed null but LLMResponse present)
        // never increments anything -- it isn't a hint.
        if (data['hintTypeUsed']==='workedExample'){
          cellModel.setMetadata('hintCounterWorkedExample', hintCounterWorkedExample+1);
        } else if (data['hintTypeUsed']==='instructionalText'){
          cellModel.setMetadata('hintCounterInstructional', hintCounterInstructional+1);
        }

        const errorContainer=document.createElement('div');
        errorContainer.classList.add('error-container');

        const errorHeader = document.createElement('div');
        errorHeader.classList.add('error-errorHeader');
        errorContainer.appendChild(errorHeader)

        const llmrenderer= rendermime.createRenderer('text/markdown');
        llmrenderer.node.classList.add('error-LLMDescription');
        errorContainer.appendChild(llmrenderer.node);
        this.widgetContainer.appendChild(errorContainer);

        const h3 = document.createElement('h3');
        if (data['hintTypeUsed']==='workedExample'){
          h3.textContent = `Hint ${data['hintNumber']}/6 Here's a similar example`;
        } else if (data['hintTypeUsed']==='instructionalText'){
          h3.textContent = `Hint ${data['hintNumber']}/6 Here's an explanation of the error:`;
        } else {
          h3.textContent = `No hint needed`;
        }
        errorHeader.appendChild(h3);

        // The backend returns the exact text to show in every case -- a
        // real LLM hint, or the above-Grey-Area message -- so this always
        // renders data['LLMResponse'] directly. This also means whatever
        // the student sees is exactly what gets logged server-side.
        const resultModel = rendermime.createModel({
          data: { 'text/markdown': data['LLMResponse'] },
          trusted: false
        });
        await llmrenderer.renderModel(resultModel);
        requestAnimationFrame(() => {
          errorContainer.scrollIntoView({ behavior: 'smooth', block: 'start' });
        });
      } catch (er: unknown) {
        if (waitingNode.parentNode) {
          waitingNode.parentNode.removeChild(waitingNode);
        }
        const errorContainer=document.createElement('div');
        errorContainer.classList.add('error-container');
        const llmrenderer= rendermime.createRenderer('text/markdown');
        llmrenderer.node.classList.add('error-LLMDescription');
        errorContainer.appendChild(llmrenderer.node);
        this.widgetContainer.appendChild(errorContainer);
        const errorModel = rendermime.createModel({
            data: { 'text/markdown': "#### Error getting feedback" },
            trusted: false
        });
        await llmrenderer.renderModel(errorModel);
    }

    async function askLLM(executionCounter:String, cellIdentifier:any,errorName:String, errorMessage:String, traceback:String,sourceCode:String,hintCounterWorkedExample:number, hintCounterInstructional:number, taskDescriptionContent: String, KC: String): Promise<any> {
      let token = PageConfig.getToken();
      let JupyterHubBaseUrl= PageConfig.getOption("JupyterHubBaseUrl");
      const HubLLMEndpoint = JupyterHubBaseUrl+'/services/askLLM/errorLog';
      const requestData = {'supportType':supportType,'cellIdentifier':cellIdentifier,executionCounter: executionCounter,errorName:errorName,errorMessage:errorMessage,traceback:traceback,sourceCode:sourceCode,hintCounterWorkedExample:hintCounterWorkedExample, hintCounterInstructional:hintCounterInstructional, "taskDescription":taskDescriptionContent, "KC":KC};

      const response = await fetch(HubLLMEndpoint, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
          'X-Requested-With': 'XMLHttpRequest' },
        body: JSON.stringify(requestData),
    });

    if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
    }
    return response.json();
  }
    }
  };

function activateWidget(app: JupyterFrontEnd, palette: ICommandPalette, notebookTracker: NotebookTracker, rendermime: IRenderMimeRegistry){

  const JupyterHubBaseUrl = PageConfig.getOption("JupyterHubBaseUrl");

  let widget: MainAreaWidget<LLMResponseWidget>;

  let lastExecutedCellId: string | null = null;

  notebookTracker.currentChanged.connect(() => {
    const notebookPanel = notebookTracker.currentWidget;
    if (notebookPanel) {
    }
  });
  /* Tracker is not working right now, might not be necessay
  if I want it to work tho, I will probably have to serialize the widget */
  const command: string = supportType+"open";
  app.commands.addCommand(command, {
    label: 'LLM Widget',
    execute: () => {
      if (!widget || widget.isDisposed) {
        setWidget()
      }
      if (!widget.isAttached) {
        // Attach the widget to the main work area if it's not there
        app.shell.add(widget, 'main',{ mode: 'split-right' });
      }
      // Activate the widget
      activateWidget()



  }});
  function setWidget(){
    const content = new LLMResponseWidget();
    widget = new MainAreaWidget({content});
    widget.id = 'LLMHelp-jupyterlab';
    widget.title.label = 'LLM Help';
    widget.title.closable = true;
  }
  function activateWidget(){
    app.shell.activateById(widget.id);
  }
  palette.addItem({ command, category: 'Tutorial' });

 function getTaskDescription(notebook:Notebook, taskDescriptionCellId:string){
  for (const cell of notebook.widgets){
    if (cell.model.getMetadata('identifier')==taskDescriptionCellId){
      const taskDescriptionJson= cell.model.toJSON()
      const taskDescriptionContent: String= String(taskDescriptionJson.source)
      return taskDescriptionContent
    }
  } return
  }



  NotebookActions.executed.connect((_, args) => {
    const { cell, notebook, success } = args;
    if (cell) {
      const cellModel = cell.model;
      if (isCodeCellModel(cellModel)){
        const cellIdentifier=cellModel.getMetadata('identifier')
        const assignedSupportType=cellModel.getMetadata('supportType')
        const hintCounterWorkedExample=(cellModel.getMetadata("hintCounterWorkedExample") as number) ?? 0
        const hintCounterInstructional=(cellModel.getMetadata("hintCounterInstructional") as number) ?? 0
        const KC=cellModel.getMetadata("KC")
        if (assignedSupportType==supportType){
        const taskDescriptionContent=getTaskDescription(notebook,cellIdentifier+"TaskDescription") ?? "";
        const cellJson = cell.model.toJSON();
        const sourceCode : String = String(cellJson.source);
        const execution_count=<number>cellJson.execution_count;
        if (execution_count){
        const outputCast = <CodeCellModel>cell.model;
        const outputs = outputCast.sharedModel.outputs;
        let outputArray=[];
        let errors: IOutput[] =[];
        for (let i=0;i<outputs.length;i++){
          if (outputs[i]['output_type']==='error'){
            errors.push(outputs[i]);
           }
          else {
             outputArray.push(outputs[i]['text']);}
        }
        if (!success) {
        // Always call the backend now -- whether a hint is shown at all,
        // and which kind, is decided server-side from the student's live
        // Grey Area zone, not by a client-side counter check. (The old
        // "hintCounter<3, else logFailure silently" branch is gone: the
        // errorLog call below both logs the attempt AND returns the hint,
        // in one request, for every attempt.)
        if (!widget || widget.isDisposed) {
          setWidget()
          activateWidget()
          app.shell.add(widget, 'main',{ mode: 'split-right' });
        }
        if (lastExecutedCellId!=cellIdentifier) {
          widget.content.clearPrompt();
        }
        lastExecutedCellId=cellIdentifier;
        widget.content.updateWidget(cellModel,execution_count,cellIdentifier,errors[0],sourceCode,hintCounterWorkedExample,hintCounterInstructional,taskDescriptionContent,rendermime,KC);
        }
        if (success) {
          const output=JSON.stringify(outputArray);
          logSuccess(execution_count,cellIdentifier,output,sourceCode, hintCounterWorkedExample, hintCounterInstructional, taskDescriptionContent,KC);
        }
      }
    } else {}
  } else {
      console.error('Cell is undefined or null.');
    }
  }});

  async function logSuccess(executionCounter:number,cellIdentifier:any,outputArray:String,sourceCode:String, hintCounterWorkedExample:number, hintCounterInstructional:number, taskDescriptionContent:String, KC:String ): Promise<any>{
    let token = PageConfig.getToken();
    const successEndpoint = JupyterHubBaseUrl+'/services/askLLM/successLog';
    const requestData = {'supportType':supportType,'cellIdentifier':cellIdentifier,"executionCounter": executionCounter,"outputArray":outputArray,"sourceCode":sourceCode,"hintCounterWorkedExample":hintCounterWorkedExample,"hintCounterInstructional":hintCounterInstructional,"taskDescriptionContent":taskDescriptionContent,"KC":KC};
    const response = await fetch(successEndpoint, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        'X-Requested-With': 'XMLHttpRequest' },
      body: JSON.stringify(requestData),
  });
  if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
  }
  return response.json();
  }




}



const plugin: JupyterFrontEndPlugin<void> = {
  id: 'workedExampleExtension:plugin',
  description: 'A JupyterLab LLM help extension.',
  autoStart: true,
  requires: [ICommandPalette, INotebookTracker, IRenderMimeRegistry],
  activate: activateWidget};


export default plugin;
