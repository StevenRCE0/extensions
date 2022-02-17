import {
  ActionPanel,
  closeMainWindow,
  CopyToClipboardAction,
  Detail,
  FileSystemItem,
  getPreferenceValues,
  getSelectedFinderItems,
  Icon,
  List,
  OpenAction,
  OpenWithAction,
  popToRoot,
  PushAction,
  ShowInFinderAction,
  showToast,
  ToastStyle
} from "@raycast/api"
import { FC, ReactElement, useEffect } from "react"
import fs from "fs"
import os from "os"
import { execSync } from "child_process"

interface Preferences {
  paths: string,
  recursive: "show" | "hide" | "recursive",
  runner?: boolean,
  finderInput?: boolean
}

interface WorkflowHandlerProps {
  pathLike: string,
  filesAsArguments: boolean
}

interface WorkflowProps {
  extension: string,
  file: string,
  preferences: Preferences
}

async function joinedSelected(joint: string) {
  let finderItems: Array<FileSystemItem> = []
  let inputFlag = true
  try {
    finderItems = await getSelectedFinderItems()
  } catch (err) {
    inputFlag = false
  }
  return {
    "inputFlag": inputFlag,
    "selected": inputFlag ? `${finderItems.map(entry => {
      return `"${entry.path}"`
    }).join(joint)}` : ""
  }
}

const handleWorkflow = async (props: WorkflowHandlerProps) => {
  const { inputFlag, selected } = await joinedSelected("\n")
  if (props.filesAsArguments && inputFlag) {
    execSync(`automator -i - "${props.pathLike}" <<EOD\n${selected}\nEOD`)
  } else {
    execSync(`automator "${props.pathLike}"`)
  }
}
const handleAppleScript = async (props: WorkflowHandlerProps) => {
  const { inputFlag, selected } = await joinedSelected(" ")
  if (props.filesAsArguments && inputFlag) {
    execSync(`osascript "${props.pathLike}" ${selected}`)
  } else {
    execSync(`osascript "${props.pathLike}"`)
  }
}
const handleShellScript = async (props: WorkflowHandlerProps) => {
  const { inputFlag, selected } = await joinedSelected(" ")
  execSync(`"${props.pathLike}"` + (props.filesAsArguments && inputFlag ? ` ${selected}` : ""))
}

const scriptOperations: { [key: string]: typeof handleWorkflow } = {
  "workflow": handleWorkflow,
  "scpt": handleAppleScript,
  "sh": handleShellScript
}

const Workflow: FC<WorkflowProps> = (props) => {
  useEffect(() => {
    scriptOperations[props.extension]({
      pathLike: props.file,
      filesAsArguments: props.preferences.finderInput || false
    }).then(() => {
      popToRoot().then()
      closeMainWindow({ clearRootSearch: true }).then()
    })
  })
  return <Detail markdown="Running workflow..." />
}

export default function Command() {
  const preferences: Preferences = getPreferenceValues()
  const fileListItems: Array<ReactElement> = []
  const pathsPathLike = preferences.paths.split(",").map(path => {
    return path.replace(/^\s/, "").replace(/^~/, os.homedir())
  })

  function walk(pathLike: string) {
    if (!fs.existsSync(pathLike)) {
      showToast(ToastStyle.Failure, `Directory "${pathLike}" is not found, please change it in extension preferences.`).then()
      return
    }
    fs.readdirSync(pathLike).forEach((file) => {
      const filePath = `${pathLike}/${file}`
      const extension = file.replace(/.+\./, "")
      if (extension.indexOf('.') === 0) return

      function handleOpen(file: string) {
        if (preferences.runner && Object.keys(scriptOperations).indexOf(extension) >= 0) {
          return {
            "open": <PushAction
              title="Run Workflow"
              target={<Workflow file={file} preferences={preferences} extension={extension} />}
              icon={Icon.Terminal}
            />,
            "openAlt": <PushAction
              title={`Run Workflow ${preferences.finderInput ? "Without" : "With"} Input`}
              target={<Workflow file={file} preferences={{ ...preferences, finderInput: !preferences.finderInput }}
                                extension={extension} />}
              icon={Icon.Terminal}
              shortcut={{ modifiers: ["opt"], key: "return" }}
            />
          }
        } else {
          return {
            "open": <OpenAction target={file} title="Open" />,
            "openAlt": null
          }
        }
      }

      if (fs.lstatSync(filePath).isDirectory() && file.indexOf(".") < 0) {
        if (preferences.recursive === "recursive") {
          walk(filePath)
          return
        }
        if (preferences.recursive === "hide") return
      }
      console.log("w: ", filePath)
      const { open, openAlt } = handleOpen(filePath)
      fileListItems.push(
        <List.Item
          title={file.replace(/(.*\/)*([^.]+).*/ig, "$2")}
          icon={{ fileIcon: filePath }}
          key={fileListItems.length}
          subtitle={extension.toLowerCase().replace(/( |^)[a-z]/g, (L) => L.toUpperCase())}
          actions={
            <ActionPanel>
              {open}
              <ShowInFinderAction
                path={filePath}
              />
              <CopyToClipboardAction
                title="Copy File Path"
                content={filePath}
                shortcut={{ modifiers: ["cmd", "opt"], key: "c" }}
              />
              <OpenWithAction
                path={filePath}
                shortcut={{ modifiers: ["cmd", "shift"], key: "enter" }}
              />
              {openAlt}
            </ActionPanel>
          }
        />
      )
    })
  }

  pathsPathLike.forEach(walk)
  return (
    <List>
      {fileListItems}
    </List>
  )
}
