'use client'
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { useLLMStore } from "@/store/llm-store"
import { models, Model } from "@/helper/models"

// Modify as needed
const options: Model[] = models

export function ModelOptions() {
  const { selectedModel, setSelectedModel } = useLLMStore()

  const handleSelectModel = (model: string) => {
    setSelectedModel(model)
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline">{selectedModel.length ? selectedModel : 'Select Model'}</Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-56">
        <DropdownMenuLabel>LLM Models</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          {
            options.map((model) => (
              <DropdownMenuItem key={model.id} onSelect={() => handleSelectModel(model.id)}>
                <span>{model.name}</span>
              </DropdownMenuItem>
            ))
          }


        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}